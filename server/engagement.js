'use strict';
// Durable daily counters only. Current-match metadata is deleted with its room;
// no names, seat IDs, tokens, IPs, chat, hands or individual history is retained.
const MODES=['classic','faction','treasury','treasuryFaction'];
const day=at=>new Date(at).toISOString().slice(0,10);
function mode(room){return room.treasuryMode?(room.revealFactions?'treasuryFaction':'treasury'):(room.revealFactions?'faction':'classic');}
function migrate(db,now=Date.now()){
 db.exec(`CREATE TABLE engagement_meta(id INTEGER PRIMARY KEY CHECK(id=1), since INTEGER NOT NULL) STRICT;
 CREATE TABLE engagement_daily(day TEXT NOT NULL, metric TEXT NOT NULL, mode TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY(day,metric,mode)) STRICT;
 CREATE TABLE engagement_active(room_code TEXT PRIMARY KEY REFERENCES rooms(code) ON DELETE CASCADE, started_at INTEGER NOT NULL, mode TEXT NOT NULL) STRICT;`);
 db.prepare('INSERT INTO engagement_meta VALUES(1,?)').run(now);
}
function record(db,next,previous,remove=false,now=Date.now()){
 const date=day(now),kind=mode(next);
 const add=(metric,value=1,m='all',d=date)=>{
  if(value)db.prepare('INSERT INTO engagement_daily VALUES(?,?,?,?) ON CONFLICT(day,metric,mode) DO UPDATE SET value=value+excluded.value').run(d,metric,m,value);
 };
 if(remove){if(previous?.status==='lobby')add('lobbies_closed_without_start');return;}
 if(!previous&&next.status==='lobby')add('rooms_created');
 const joined=(key)=>(next[key]||[]).filter(p=>!(previous?.[key]||[]).some(old=>old.id===p.id)).length;
 // A restored snapshot is already present, so presence changes never count as joins.
 add('player_seat_joins',joined('players'));add('spectator_seat_joins',joined('spectators'));
 if(previous?.status==='lobby'&&next.status==='playing'){
  db.prepare('INSERT INTO engagement_active VALUES(?,?,?)').run(next.code,now,kind);
  add('matches_started',1,kind);add('player_participations',next.players.length,kind);
  add(next.visibility==='public'?'public_starts':'private_starts',1,kind);
 }
 if(previous?.status==='playing'&&next.status==='finished'){
  const active=db.prepare('SELECT started_at,mode FROM engagement_active WHERE room_code=?').get(next.code);
  // Matches already in progress when metrics are installed have no measured start.
  if(!active)return;
  add('matches_completed',1,active.mode);
  add('completed_for_starts',1,active.mode,day(active.started_at));
  add('duration_ms',Math.max(0,now-active.started_at),active.mode);
  add('completed_turns',Math.max(0,next.turnNumber||0),active.mode);
  add(next.winType==='economy'?'wealth_wins':'elimination_wins',1,active.mode);
  db.prepare('DELETE FROM engagement_active WHERE room_code=?').run(next.code);
 }
}
function report(db,days=30,now=Date.now()){
 if(![0,7,30,90].includes(days))throw Error('Invalid metrics range.');
 const since=db.prepare('SELECT since FROM engagement_meta WHERE id=1').get().since;
 const from=days?day(now-(days-1)*86400000):day(since),to=day(now);
 const rows=db.prepare('SELECT day,metric,mode,value FROM engagement_daily WHERE day>=? AND day<=? ORDER BY day').all(from,to);
 const sum=(metric,m)=>rows.filter(r=>r.metric===metric&&(!m||r.mode===m)).reduce((n,r)=>n+r.value,0);
 const stats=m=>{
  const started=sum('matches_started',m),completed=sum('matches_completed',m);
  return {started,completed,completionRate:started?sum('completed_for_starts',m)/started:null,playerParticipations:sum('player_participations',m),averagePlayers:started?sum('player_participations',m)/started:null,averageDurationMs:completed?sum('duration_ms',m)/completed:null,averageTurns:completed?sum('completed_turns',m)/completed:null,publicStarts:sum('public_starts',m),privateStarts:sum('private_starts',m),wealthWins:sum('wealth_wins',m),eliminationWins:sum('elimination_wins',m)};
 };
 // All-time totals use every day; the daily table is bounded to its latest 90 days.
 const dailyFrom=days?from:day(Math.max(since,now-89*86400000));
 const daily=[];
 for(let at=Date.parse(dailyFrom+'T00:00:00Z');at<=Date.parse(to+'T00:00:00Z');at+=86400000){
  const date=day(at),values=rows.filter(r=>r.day===date);
  const total=metric=>values.filter(r=>r.metric===metric).reduce((n,r)=>n+r.value,0);
  daily.push({day:date,roomsCreated:total('rooms_created'),started:total('matches_started'),completed:total('matches_completed'),playerSeatJoins:total('player_seat_joins')});
 }
 return {since,generatedAt:now,days,from,to,totals:{roomsCreated:sum('rooms_created'),playerSeatJoins:sum('player_seat_joins'),spectatorSeatJoins:sum('spectator_seat_joins'),lobbiesClosedWithoutStart:sum('lobbies_closed_without_start'),...stats()},modes:MODES.map(id=>({id,...stats(id)})),daily};
}
module.exports={migrate,record,report,mode,MODES};

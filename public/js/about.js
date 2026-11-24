/* The information page shares the app's copy, language and project components. */
(function(){
 const app=document.getElementById('about-app'),i18n=window.URAMAKU_I18N,project=window.URAMAKU_PROJECT;
 let lang=i18n.getLanguage();project.bind(app);
 function render(){document.documentElement.lang=lang==='jp'?'ja':'en';document.title=i18n.get('projectAbout',lang)+' · URAMAKU';app.innerHTML=project.about({lang});document.getElementById('languageToggle').onclick=()=>{lang=lang==='en'?'jp':'en';i18n.setLanguage(lang);render();};}
 render();
})();

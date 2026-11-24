# Public beta information for review

Home and the waiting lobby use a compact text wordmark with a Public beta badge in place of the large banner. The approved image remains available to the game background; no artwork file was changed or deleted.

Home explains the beta status and AI-generated artwork beside the room entry controls. A separate warm panel introduces the planned physical edition and Kickstarter campaign. Campaign timing and production details are intentionally unspecified.

The shared footer links to **About URAMAKU**, **Artwork and credits**, and **Feedback**. The About page works now at `/about.html`, with sections for beta status, artwork, development and feedback. It uses the existing language preference and switches between English and Japanese. Game design credits use the project name pending the owner's preferred public credit.

Kickstarter and Send feedback are labelled **coming soon**. Clicking them does nothing. They have no external destination, form, mailing list, analytics or collection endpoint. Replace them with real destinations only when those are available. About and Development plans are functioning internal links.

Implementation is shared in `public/js/components/project-info.js`; all copy lives in `shared/i18n.js`. Home and tutorial load the same component. The information page controller is `public/js/about.js`, with styles in `public/css/source/06-lobby-and-interactions.css`. Rebuild `public/css/game.css` with `npm run build:css` after style edits.

Review on a desktop and a phone: Home spacing, disclosure prominence, campaign copy, footer contrast, About sections and language changes. The automated checks cover DOM behavior and navigation; a rendered-browser visual review remains useful.

# canvg-client

A port of canvg, which pareses svg input and renders the result to a canvas.
http://code.google.com/p/canvg/

This fork is meant for client-only usage and does not depend on the Canvas package,
which can make problems with platforms such as Heroku.

## Usage
```` js
var var targetElement = document.getElementById("targetId")
var svg = '<svg><circle cx="50" cy="50" r="40" stroke-width="3" fill="red" /></svg>';
 canvg(targetElement, svg);


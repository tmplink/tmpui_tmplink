const fs = require('fs');
let css = fs.readFileSync('css/sponsor.css', 'utf-8');

// Ensure that color vars bleed through correctly to vxui classes globally without overspecificity 
if (!css.includes('body.sponsor-mode {')) {
  console.log("Error finding sponsor mode root");
}

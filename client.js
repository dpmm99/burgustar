const serverUrl = window.location.origin == "file://" ? "http://127.0.0.1:3000/" : (window.location.origin + "/burgustar/server/");
const sheets = [];
var gameView = document.getElementById("gameview"), mapGroup = document.getElementById("mapgroup"), hudGroup = document.getElementById("hudgroup");
var scrollX = 0, scrollY = 0;
var shownMenu = null;
var language = "EN"; //Options: JP or EN (which isn't actually explicitly used anywhere)
var dualLanguage = false;
var desaturateAlliedUnits = true;
const hasMouse = () => window.matchMedia("(pointer: fine)").matches; //CSS4 Media Queries are great for determining whether we need to resize the elements or provide alternative display methods for tooltips and such.
const screenIsTiny = () => window.devicePixelRatio > 2;
var displayScale = 1;

//Functions for preparing the graphics
var sprites = 0;
function generateSpriteClipPath(x, y, w, h) {
	var id = "sprite" + sprites++;
	var defs = gameView.querySelector("defs");
	defs.insertAdjacentHTML("beforeend", `<path d="M${x},${y} ${x},${y+h} ${x+w},${y+h} ${x+w},${y}z" id="${id}path" />`);
	defs.insertAdjacentHTML("afterend", `<clipPath id="${id}" data-x="${x}" data-y="${y}"><use xlink:href="#${id}path" clip-rule="evenodd" /></clipPath>`);
	return document.getElementById(id);
}

function createSpritesheet(w, h, sheetURI) {
	var img = new Image();
    img.src = sheetURI; //ensures it gets loaded even if it doesn't get used right away
	return { w: w, h: h, uri: sheetURI, img: img };
}

//Load up all the sheets and sprites
var firstHalfSizedSprite = unitDefinitions.findIndex(p => p.category == 10); //just so I don't have to update it repeatedly as I make changes
sheets.push(createSpritesheet(TILE_SIZE * firstHalfSizedSprite + TILE_SIZE / 2 * Math.floor((unitDefinitions.length - firstHalfSizedSprite) / 2), TILE_SIZE, "Sprites.png"));
for (var x = 0; x < firstHalfSizedSprite; x++) unitDefinitions[x].clipPath = generateSpriteClipPath(x * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
for (var x = 0; x < unitDefinitions.length - firstHalfSizedSprite; x++) unitDefinitions[firstHalfSizedSprite + x].clipPath = generateSpriteClipPath(firstHalfSizedSprite * TILE_SIZE + Math.floor(x / 2) * TILE_SIZE / 2, (x & 1) * TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2);

//Functions for actual display
function addSprite(elem, x, y, unitDef, extraGroup) {
	var domSprite = document.createElementNS("http://www.w3.org/2000/svg", "g");
	var sheet = sheets[unitDef.sheet || 0]; //Default to sheet 0 if one isn't specified
	domSprite.innerHTML = `<image width="${sheet.w}" height="${sheet.h}" href="${sheet.uri}">`;
	if (extraGroup) { //Wrap it in an extra <g> tag, for grouping overlays with the sprite so that clicking on them behaves the same as clicking the sprite
		extraGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
		extraGroup.appendChild(domSprite);
		domSprite = extraGroup;
	}
	updateSprite(domSprite, x, y, unitDef);
	elem.appendChild(domSprite);
	return domSprite;
}
function updateSprite(domSprite, x, y, unitDef) {
	var actualSprite = domSprite.querySelector("image");
	actualSprite.setAttribute("filter", `url(#fcat${unitDef.category})`);
    actualSprite.parentElement.setAttribute("clip-path", `url(#${unitDef.clipPath.id})`); //May not be domSprite, but also may be domSprite :P
	actualSprite.parentElement.setAttribute("filter", `url(#ftier${unitDef.tier})`);

	if (actualSprite.parentElement != domSprite) { //If we have two groupings, we can use two transforms; otherwise, we need to combine them (which can be done via "translate(x,y), translate(x,y)" or by adding the numbers directly)
        actualSprite.parentElement.setAttribute("transform", `translate(${-unitDef.clipPath.dataset.x},${-unitDef.clipPath.dataset.y})`);
	} else {
        x -= unitDef.clipPath.dataset.x;
        y -= unitDef.clipPath.dataset.y;
    }
    domSprite.setAttribute("transform", `translate(${x},${y})`);
}

function languageSwitch(obj, field, primaryLanguage = "JP", dualLanguage, separator = " / ") {
    return dualLanguage ? ((obj[field + primaryLanguage] ? (obj[field + primaryLanguage] + separator) : "") + obj[field]) : (obj[field + primaryLanguage] || obj[field]);
}

var hud = { height: 0, viewMode: 1, menuOptions: [] }; //needs to be used in two functions
function updateHUD() {
	var state = gameStates[viewingGameStateIdx]; //Aliases for shorter code
	var player = state.players[viewAsPlayerIdx];
	const bodyWidth = Math.floor(document.body.clientWidth / displayScale / TILE_SIZE) * TILE_SIZE;

	var xPos = 0;
	var yPos = 0;
	for (var x = 0; x < player.resources.length; x++) {
		var thisResourceTilesWide = 3;
		if (resourceDefinitions[x].reserveInsteadOfConsume) thisResourceTilesWide += 2; //Extra space for extra text

        var maxHUDTextWidth = (thisResourceTilesWide - 1) * TILE_SIZE - 5 - 2 - 2; //The 5 is the 5px stroke width, and the 2 is the fixed left margin between the icon and the text (doubled to also make a right margin before the next icon)
        if (xPos > 0 && xPos > bodyWidth - TILE_SIZE * thisResourceTilesWide) {
            xPos = 0;
            yPos += TILE_SIZE + 2;
		}

		//Prepare the container and icon for the resource
		var resourceGroup = document.getElementById("resourceGroup" + x);
		if (resourceGroup == null) {
			resourceGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
			resourceGroup.id = "resourceGroup" + x;
			var resourceSprite = addSprite(resourceGroup, 0, 0, resourceDefinitions[x]);
            resourceSprite.insertAdjacentHTML("beforeend", `<title>${languageSwitch(resourceDefinitions[x], "name", language, dualLanguage)}</title>`);
			resourceGroup.insertAdjacentHTML("beforeend", `<text x="${TILE_SIZE+2}" y="${TILE_SIZE/2}" dominant-baseline="central" lengthAdjust="spacingAndGlyphs"></text>`);
			hudGroup.appendChild(resourceGroup);
		}

		//Display the resource amount text
		resourceGroup.setAttribute("transform", `translate(${xPos},${yPos})`);
		if (hud.viewMode == 0) {
			if (viewingGameStateIdx > 0) {
				var playerPrev = gameStates[viewingGameStateIdx - 1].players[viewAsPlayerIdx];
				//TODO: Ain't this simple, because construction costs are applied directly to the previous game state before we advanced to this game state...meaning the last construction's cost isn't included in these change numbers.
				if (resourceDefinitions[x].reserveInsteadOfConsume) resourceGroup.lastElementChild.textContent = ": " + (player.resources[x] - (player.resourcesConsumed[x] || 0) - playerPrev.resources[x] + (playerPrev.resourcesConsumed[x] || 0)) + "/" + (player.resources[x] - playerPrev.resources[x]);
				else resourceGroup.lastElementChild.textContent = ": " + (player.resources[x] - playerPrev.resources[x]);
			} else {
				if (resourceDefinitions[x].reserveInsteadOfConsume) resourceGroup.lastElementChild.textContent = ": -/-";
				else resourceGroup.lastElementChild.textContent = ": -";
            }
		} else if (hud.viewMode == 1) {
			if (resourceDefinitions[x].reserveInsteadOfConsume) resourceGroup.lastElementChild.textContent = ": " + (player.resources[x] - (player.resourcesConsumed[x] || 0)) + "/" + player.resources[x];
			else resourceGroup.lastElementChild.textContent = ": " + player.resources[x];
		} else {
			//TODO: After each enable/disable or after a turn changes, need to refresh the details, keeping the info somewhere accessible, because we absolutely cannot update that info in updateHud(). Resizing would be sooo laggy.
        }

		//Make it fit nicely
        resourceGroup.lastElementChild.removeAttribute("textLength");
        if (resourceGroup.lastElementChild.getBBox().width > maxHUDTextWidth) resourceGroup.lastElementChild.setAttribute("textLength", maxHUDTextWidth);

		//TODO: Show deficiencies and produced/consumed in the HUD (currently just highlighting red if deficient)
		var deficiency = player.resourcesInsufficient[x] - player.resources[x] + (resourceDefinitions[x].reserveInsteadOfConsume ? player.resourcesConsumed[x] : 0);
		resourceGroup.lastElementChild.style.fill = deficiency > 0 ? "#f55" : "#bf9";
        if (x == RES_ENEMY_STRENGTH && player.resources[RES_ENEMY_STRENGTH] > player.resources[RES_READINESS] * 0.99) resourceGroup.lastElementChild.style.fill = "#f00";
        else if (x == RES_ENEMY_STRENGTH && player.resources[RES_ENEMY_STRENGTH] > player.resources[RES_READINESS] * 0.95) resourceGroup.lastElementChild.style.fill = "#f55";
		
        xPos += TILE_SIZE * thisResourceTilesWide;
	}

	//Add an info button, language button, and screenshot button
	var hudButtonGroup = document.getElementById("hudButtonGroup");
	var buttonCount = 4; //Ensuring the buttons stay on one row, I'm not adjusting xPos within the next block.
    if (hudButtonGroup == null) {
        hudButtonGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        hudButtonGroup.id = "hudButtonGroup";
		hudGroup.appendChild(hudButtonGroup);

		var buttonSprite = addSprite(hudButtonGroup, 0, 0, unitDefinitions[HUD_BUTTON_INFO]);
		buttonSprite.style.cursor = "pointer";
        buttonSprite.insertAdjacentHTML("beforeend", `<title>${languageSwitch(unitDefinitions[HUD_BUTTON_INFO], "name", language, dualLanguage)}</title>`); //TODO: JP: this title needs to be set outside this block or also in languageSettingsChanged()
		buttonSprite.onmousedown = (event) => {
			event.stopPropagation();
			event.preventDefault();
			showInfoWindow();
		}

        hudButtonGroup.insertAdjacentHTML("beforeend", `<text x="${TILE_SIZE*1}" y="${TILE_SIZE/2}" dominant-baseline="central" textLength="${TILE_SIZE}" lengthAdjust="spacingAndGlyphs" style="font-size:${TILE_SIZE}px;cursor:pointer;">EN</text>`);
		var languageButton = hudButtonGroup.lastElementChild;
		languageButton.onmousedown = (event) => {
            if (language == "JP" && !dualLanguage) { dualLanguage = true; languageButton.textContent = "A+あ"; } //TODO: might be better to open a special HUD menu for selecting the language.
			else if (language == "JP") { language = "EN"; dualLanguage = false; languageButton.textContent = "A"; }
			else { language = "JP"; languageButton.textContent = "あ"; }
			languageSettingsChanged();
			shownMenu.elem.replaceChildren();
			shownMenu.nameText = ""; //In case the info menu is open, it's going to reset to have nothing selected, so clear out the name area
			updateMenu();

            event.stopPropagation();
			event.preventDefault();
		}

        buttonSprite = addSprite(hudButtonGroup, TILE_SIZE * 2, 0, unitDefinitions[HUD_BUTTON_SCREENSHOT]);
        buttonSprite.style.cursor = "pointer";
        buttonSprite.insertAdjacentHTML("beforeend", `<title>${languageSwitch(unitDefinitions[HUD_BUTTON_SCREENSHOT], "name", language, dualLanguage)}</title>`);
        buttonSprite.onmousedown = (event) => {
            event.stopPropagation();
            event.preventDefault();
            makePoster();
		}

		//Button to open a menu that contains options for HUD views
		buttonSprite = addSprite(hudButtonGroup, TILE_SIZE * 3, 0, unitDefinitions[HUD_BUTTON_HUD_VIEW_MODE]);
		buttonSprite.style.cursor = "pointer";
		buttonSprite.insertAdjacentHTML("beforeend", `<title>${languageSwitch(unitDefinitions[HUD_BUTTON_HUD_VIEW_MODE], "name", language, dualLanguage)}</title>`);
		buttonSprite.onmousedown = (event) => {
			event.stopPropagation();
			event.preventDefault();
			if (hud.menuOptions.length) {
				hud.menuOptions = [];
				return; //Just close the menu
			}
			var menuW = TILE_SIZE * (dualLanguage ? 15 : 9);
			//Make it match the button location (relative to hudGroup), but adjust leftward based on menuW if it's too far to the right. The hudGroup location isn't known yet when this mousedown event is created, but the arrow function's context variable capture takes care of that.
			var menuX = Math.min(xPos + TILE_SIZE * 3, gameView.viewBox.baseVal.width - menuW);
			var menuY = yPos;
			var options = [{ name: "Last Change", nameJP: "最新の変更" }, { name: "Current Total", nameJP: "現在の合計" }, {name: "Projected Change", nameJP: "予測される変更"}];
			for (let x = 0; x < options.length; x++) {
				hudGroup.insertAdjacentHTML("beforeend", `<g transform="translate(${menuX},${menuY - TILE_SIZE * x})"><rect width="${menuW}" height="${TILE_SIZE}" fill="#171717" stroke-width="0" /><text x="2" y="${TILE_SIZE / 2}" dominant-baseline="central" lengthAdjust="spacingAndGlyphs">${languageSwitch(options[x], "name", language, dualLanguage)}</text></g>`);
				hud.menuOptions.push(hudGroup.lastElementChild);
				hudGroup.lastElementChild.style.cursor = "pointer";
				hudGroup.lastElementChild.onclick = (event) => {
					hud.viewMode = x;
					hud.menuOptions.forEach(p => p.remove());
					hud.menuOptions = [];
					updateHUD();
					event.stopPropagation();
					event.preventDefault();
				};
				//Cap the text width
				if (hud.menuOptions[x].lastElementChild.getBBox().width > menuW - 4) hud.menuOptions[x].lastElementChild.setAttribute("textLength", menuW - 4);
			}
		}
    }
    if (xPos > 0 && xPos > bodyWidth - TILE_SIZE * buttonCount) {
        xPos = 0;
        yPos += TILE_SIZE + 2;
	}
	hudButtonGroup.setAttribute("transform", `translate(${xPos},${yPos})`);
	//TODO: adjust the location at which the hud.menuOptions appear

    hud.height = yPos + TILE_SIZE;
	hudGroup.setAttribute("transform", `translate(${scrollX},${scrollY + gameView.viewBox.baseVal.height - hud.height})`);

	//document.getElementById("chat").style.bottom = hud.height + "px";
}

//Some elements don't get destroyed and recreated when updateDisplay() is called, so this will update the text in them.
function languageSettingsChanged() {
    for (var x = 0; x < gameStates[viewingGameStateIdx].players[viewAsPlayerIdx].resources.length; x++) {
		document.getElementById("resourceGroup" + x).querySelector("title").textContent = languageSwitch(resourceDefinitions[x], "name", language, dualLanguage);
	}
	var hudButtonGroup = document.getElementById("hudButtonGroup");
	hudButtonGroup.querySelector("title").textContent = languageSwitch(unitDefinitions[HUD_BUTTON_INFO], "name", language, dualLanguage);
}

function wrapSvgText(elem, leftPad, maxWidth, maxSquish, maxLines, text) { //Word wrap for relatively small amounts of text (it's not super efficient)
	elem.textContent = text;
	maxWidth -= leftPad; //Remove the padding from the overall width for all calculations herein
	var lengthEstimate = elem.getBBox().width; //Calculate the total text length assuming we don't squish it any or leave out spaces due to word wrap (hence "estimate")
	do {
		if (lengthEstimate <= maxWidth) break; //Fits fine on one line
		if (lengthEstimate <= maxWidth + maxSquish || maxLines == 1) { //Fits on one line if we squish it no more than the allowed amount (which is infinity if maxLines == 1)
			elem.setAttribute("x", leftPad);
            elem.setAttribute("lengthAdjust", "spacingAndGlyphs");
			elem.setAttribute("textLength", maxWidth);
			break;
		}
		elem.innerHTML = ""; //Clear the element out so we can set up multiple <tspans>, each potentially having its own squish amount

		var lines = 0;
		var newElem;
		var newText;
		var remainingText = text;

		//Split up the text into as many lines as you think it needs. Prefer splitting after spaces or after hyphens, though there isn't much I can do about good Japanese word wrap or mid-word wrap unless I want to program in multiple entire dictionaries... plus obey http://www.unicode.org/reports/tr14/tr14-45.html
		//Take words out of remainingText until it no longer fits, then put the last word back in
		while (remainingText.length && lines <= maxLines) {
			var newElem = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
            newElem.setAttribute("x", leftPad);
			elem.appendChild(newElem);
            newElem.textContent = newText = remainingText.trim(); //Don't start a line with a space
			remainingText = "";
			do {
				var textWidth = newElem.getBBox().width;
				if (textWidth > maxWidth + maxSquish) {
					//Move the last word from newElem.textContent to remainingText. Could use lengthEstimate to try to move multiple words at a time.
                    var movable = newText.lastIndexOf(" ");
					if (movable > 1) {
                        var chopped = newText.substring(movable);
                        newElem.textContent = newText = newText.substring(0, movable);
						remainingText = chopped + remainingText;
					} else {
						//TODO: hyphen, then mid-word breaks
                        movable = newText.length - 1;
                        remainingText = newText.substring(movable) + remainingText;
                        newElem.textContent = newText = newText.substring(0, movable);
                    }
				}
			} while (textWidth > maxWidth + maxSquish);
			if (textWidth > maxWidth) { //Squish only if needed
                newElem.setAttribute("lengthAdjust", "spacingAndGlyphs");
                newElem.setAttribute("textLength", maxWidth);
            }

			//Set the vertical position of this line of text
			if (lines) newElem.setAttribute("dy", "1em"); //Always 1em from the *previous* tspan
			lines++;
        }

		//If maxLines is exceeded, increase maxSquish and try again.
		maxSquish += Math.max(10, Math.floor(0.9 * (lines - maxLines) * maxWidth));
	} while (lines > maxLines);

	return elem.getBBox().height;
}

function updateMenu(advancingTurn) {
    var state = gameStates[viewingGameStateIdx]; //Aliases for shorter code
    var player = state.players[viewAsPlayerIdx];

	if (advancingTurn) {
		if (state.enemyApproach == ENEMY_APPROACH_NOTICE) {
			if (shownMenu) shownMenu.close();
			shownMenu = new MapCoordMenu("simpleNotice", 0, 0);
			shownMenu.text = "The enemy is approaching. We need to increase our Military Readiness to at least the level of the Enemy Strength displayed in the status bar within three cycles. If we can do so, it should convince the hostiles to retreat and wait for a better opportunity before they try to attack again. We can only hope that they don't become more aggressive due to our carelessness.";
			shownMenu.textJP = "敵が近づいてくる。3太陽周期以内に、ステータスバーに表示される敵の強さのレベル（敵勢）まで軍事態勢を強化しないといけない。すると、敵対者に撤退するように説得するはずだ。そして彼らは再び攻撃を試みる前に、より良い機会を待つだろう。私達が不注意だったお陰でもっと攻撃的にならないことを願うしかできない。";
		} else if (state.enemyApproach == ENEMY_REPEL_CHECK) {
			if (shownMenu) shownMenu.close();
			shownMenu = new MapCoordMenu("simpleNotice", 0, 0);
			shownMenu.text = "Well done. We managed to improve our posture and flaunt our strength, reducing the invasion force's morale and sending them back to their own colony without a single drop of blood shed on either side. At least... I assume these aliens have blood.";
			shownMenu.textJP = "よくやった。軍事姿勢を改善し、戦力を誇示した。それで侵略軍の士気を低下させ、どちらの側にも一滴の血を流すことなく、彼らをコロニーに送り返しました。血とは...宇宙人が持っているだろうか。";
		} else if (state.enemyApproach == GAME_OVER) {
			if (shownMenu) shownMenu.close();
			shownMenu = new MapCoordMenu("simpleNotice", 0, 0);
			shownMenu.text = "Negotiations--that is, our cold war--have failed. Our mission was to produce lasting peace without bloodshed by showing that we have overwhelming strength but are unwilling to use it, but we must engage and defend ourselves even if there was no enmity between our colonies before. Perhaps our plan was flawed.";
			shownMenu.textJP = "交渉、つまりこの冷戦は失敗に終わってしまった。私達の使命は、圧倒的な強さを持ちながらも使いたくないことを示すことで、流血のない永続的な平和を生み出すことだった。が、以前は植民地間に敵意がなかったとしても、自分を守るために敵と交戦しなければならない。恐らく私達の計画には欠陥があっただろう。";
		}
	}

	if (shownMenu) {
		shownMenu.elem.remove();
		mapGroup.appendChild(shownMenu.elem); //Needs to be kept above all other drawn elements in mapGroup, so it should always be moved to the last element when redrawing
		const menuSpriteScale = 0.75;

		if (shownMenu.type == "buildCategories") {
			shownMenu.elem.style.cursor = "pointer";
			if (!shownMenu.elem.firstElementChild) { //Construct the menu contents
                var buildableCategories = unitCategories.filter((p, idx) => !p.hide && unitDefinitions.some(q => q.category == idx && !q.nobuild)); //TODO: If you clicked on a unit, may as well only show options with mustBuildOn matching that unit
				shownMenu.elem.insertAdjacentHTML("beforeend", `<rect width="${TILE_SIZE}" height="${TILE_SIZE}" fill="rgba(255,255,0,0.5)" stroke-width="0" />`); //Construction area highlight

				const catMenuWidth = (dualLanguage ? 10 : 7) * TILE_SIZE; //Wider when dual-language mode is active
				const maxCatMenuTextWidth = catMenuWidth - TILE_SIZE - 4;
				if (!player.buildabilityMatrix) player.buildabilityMatrix = getBuildableLocationsForPlayer(currentGameConfig, state, viewAsPlayerIdx); //Calculate if missing when needed
				if (!player.buildabilityMatrix[shownMenu.x + shownMenu.y * currentGameConfig.w]) {
					buildableCategories = []; //Can't build anything
                    shownMenu.elem.lastElementChild.setAttribute("fill", "rgba(64,32,32,0.5)"); //Reddish-gray to show there's nothing you can do
                    shownMenu.elem.insertAdjacentHTML("beforeend", `<g transform="translate(0,${TILE_SIZE})"><rect width="${catMenuWidth}" height="${TILE_SIZE}" fill="#171717" stroke-width="0" /><text x="${TILE_SIZE+2}" y="${TILE_SIZE/2}" dominant-baseline="central">(${languageSwitch({t: "No actions", tJP: "制御なし"}, "t", language, dualLanguage)})</text></g>`);
                    if (shownMenu.elem.lastElementChild.lastElementChild.getBBox().width > maxCatMenuTextWidth) shownMenu.elem.lastElementChild.lastElementChild.setAttribute("textLength", maxCatMenuTextWidth);
                }

				for (var x = 0; x < buildableCategories.length; x++) {
					let catIndex = unitCategories.indexOf(buildableCategories[x]);
                    shownMenu.elem.insertAdjacentHTML("beforeend", `<g transform="translate(0,${TILE_SIZE*(x+1)})"><rect width="${catMenuWidth}" height="${TILE_SIZE}" fill="#171717" stroke-width="0" /><text x="${TILE_SIZE+2}" y="${TILE_SIZE/2}" dominant-baseline="central" lengthAdjust="spacingAndGlyphs">${languageSwitch(buildableCategories[x],"name",language,dualLanguage)} &gt;</text></g>`);
                    if (shownMenu.elem.lastElementChild.lastElementChild.getBBox().width > maxCatMenuTextWidth) shownMenu.elem.lastElementChild.lastElementChild.setAttribute("textLength", maxCatMenuTextWidth);

                    var newSprite = addSprite(shownMenu.elem.lastElementChild, 0, 0, unitDefinitions.find(p => p.category == catIndex && p.tier == 2)); //Shows the first tier-2 unit in that category as the example
                    newSprite.setAttribute("transform", `translate(${(1-menuSpriteScale)*TILE_SIZE/2},${(1-menuSpriteScale)*TILE_SIZE/2}) scale(${menuSpriteScale}) ` + newSprite.getAttribute("transform")) //but shrink that sprite just a bit (the extra translation is to keep it centered)
					shownMenu.elem.lastElementChild.onmousedown = (event) => {
						if (event.button) return;
						shownMenu.type = "buildUnits";
						shownMenu.category = catIndex;
						updateDisplay();
						event.stopPropagation();
						event.preventDefault();
					};
				}
				shownMenu.width = catMenuWidth;
				shownMenu.height = TILE_SIZE * buildableCategories.length; //height of the part below the highlighted square, anyway
			}
		} else if (shownMenu.type == "buildUnits") {
            shownMenu.elem.style.cursor = "pointer";
			shownMenu.elem.replaceChildren([]); //Empty it out (this menu expects the buildCategories one to have been there first)
			var buildableUnits = unitDefinitions.filter(p => p.category == shownMenu.category && !p.nobuild && p.upgradeFrom === undefined); //Upgrades will be shown in the alterUnit menu
			shownMenu.elem.insertAdjacentHTML("beforeend", `<rect width="${TILE_SIZE}" height="${TILE_SIZE}" fill="rgba(255,255,0,0.5)" stroke-width="0" />`); //Construction area highlight
			let onUnit = state.units.find(p => p.x == shownMenu.x && p.y == shownMenu.y);
            const buildMenuWidth = (dualLanguage ? 15 : 9) * TILE_SIZE; //Wider when dual-language mode is active
			const maxBuildMenuTextWidth = buildMenuWidth - TILE_SIZE - 4;
			var yPos = 0;
			for (var x = 0; x < buildableUnits.length; x++) {
				shownMenu.elem.insertAdjacentHTML("beforeend", `<g transform="translate(0,${yPos+TILE_SIZE})"><rect width="${buildMenuWidth}" height="${TILE_SIZE}" fill="#171717" stroke-width="0" /><text x="${TILE_SIZE+2}" y="${TILE_SIZE/2}" dominant-baseline="central" lengthAdjust="spacingAndGlyphs">${languageSwitch(buildableUnits[x],"name",language,dualLanguage)}</text></g>`);
				if (shownMenu.elem.lastElementChild.lastElementChild.getBBox().width > maxBuildMenuTextWidth) shownMenu.elem.lastElementChild.lastElementChild.setAttribute("textLength", maxBuildMenuTextWidth);
				var newSprite = addSprite(shownMenu.elem.lastElementChild, 0, 0, buildableUnits[x]); //Show the normal in-game image for that unit
                newSprite.setAttribute("transform", `scale(${menuSpriteScale}) translate(${(1 - menuSpriteScale) * TILE_SIZE / 2},${(1 - menuSpriteScale) * TILE_SIZE / 2}) ` + newSprite.getAttribute("transform")); //but shrink that sprite just a bit (the extra translation is to keep it centered)

                let unitDefID = unitDefinitions.indexOf(buildableUnits[x]);
                let delta = { playerIdx: viewAsPlayerIdx, action: ACT_BUILD, x: shownMenu.x, y: shownMenu.y, unitDefID: unitDefID };

				//Add consumption/production information
				var thisMenuItemHeight = menuAddResourceDeltaInfo(false, [{ unitDefID: unitDefID, x: shownMenu.x, y: shownMenu.y }], buildMenuWidth, TILE_SIZE, onUnit ? onUnit.unitDefID : -1);

				//Show buildings that can't be built currently via applying fcat8, ftier0 to the icon and fill:#999 to the text
				var reason = gameStates[viewingGameStateIdx].getReasonIfInvalid(currentGameConfig, delta);
                if (reason) {
                    newSprite.querySelector("image").setAttribute("filter", `url(#fcat${CAT_HUD})`); //Grayscale
                    newSprite.setAttribute("filter", `url(#ftier0)`); //The darkest color
					shownMenu.elem.lastElementChild.querySelector("text").style.fill = "#999"; //Gray text

					if (!reason.hide) { //Don't waste space showing the 'Insufficient resources.' reason because we already have a colorized resource icon for that.
						shownMenu.elem.lastElementChild.insertAdjacentHTML("beforeend", `<text style="fill:#c00" y="${thisMenuItemHeight + TILE_SIZE / 2}">${languageSwitch(reason, "text", language, dualLanguage)}</text>`);
						thisMenuItemHeight += wrapSvgText(shownMenu.elem.lastElementChild.lastElementChild, 8, buildMenuWidth, 30, 3, languageSwitch(reason, "text", language, dualLanguage)) + 4;
					}
				} else if (buildableUnits[x].multiConstruct) { //A unit that can be built in multiples in a row during one turn; open a new pseudo-menu if this kind of unit is selected
                    shownMenu.elem.lastElementChild.onmousedown = (event) => {
						if (event.button) return;
						shownMenu.elem.replaceChildren([]);
						shownMenu.type = "multiConstruct";
						shownMenu.unitDefID = unitDefID;
						updateDisplay();
                        event.stopPropagation();
                        event.preventDefault();
                    };
				} else { //Normal construction
					shownMenu.elem.lastElementChild.onmousedown = (event) => {
						if (event.button) return;
						if (!gameStates[viewingGameStateIdx].getReasonIfInvalid(currentGameConfig, delta)) {
                            shownMenu.close();
							gameStates[viewingGameStateIdx].update(currentGameConfig, delta);
							clientAdvanceTurn(); //Normal builds end the turn
						}
						event.stopPropagation();
						event.preventDefault();
					};
				}

                shownMenu.elem.lastElementChild.querySelector("rect").setAttribute("height", thisMenuItemHeight);
                yPos += thisMenuItemHeight;
			}
			shownMenu.width = buildMenuWidth;
			shownMenu.height = yPos; //height of the part below the highlighted square, anyway
		} else if (shownMenu.type == "alterUnit") {
			shownMenu.elem.style.cursor = "pointer";
			var unitsAtLocation = state.units.filter(p => p.x == shownMenu.x && p.y == shownMenu.y);
			if (!shownMenu.elem.firstElementChild) { //Construct the menu contents
				shownMenu.elem.insertAdjacentHTML("beforeend", `<rect width="${TILE_SIZE}" height="${TILE_SIZE}" fill="rgba(255,100,0,0.5)" stroke-width="0" />`); //Demolition area highlight

                var possibleActions = [{ playerIdx: viewAsPlayerIdx, action: ACT_DISABLE, x: shownMenu.x, y: shownMenu.y, text: "Disable", textJP: "無効にする", hideWhenInvalid: true },
                    { playerIdx: viewAsPlayerIdx, action: ACT_ENABLE, x: shownMenu.x, y: shownMenu.y, text: "Enable", textJP: "有効にする", hideWhenInvalid: true },
					{ playerIdx: viewAsPlayerIdx, action: ACT_DEMOLISH, x: shownMenu.x, y: shownMenu.y, text: "Demolish", textJP: "解体する" }]
                    .concat(unitDefinitions.map((p, idx) => { return { playerIdx: viewAsPlayerIdx, action: ACT_BUILD, x: shownMenu.x, y: shownMenu.y, text: p.name, textJP: p.nameJP, unitDefID: idx, upgradeFrom: p.upgradeFrom } })
                        .filter(p => unitsAtLocation.some(q => p.upgradeFrom == q.unitDefID))) //Only show upgrade entries that could apply to one of the clicked units (but don't use hideWhenInvalid)
					.filter(p => !(p.reason = gameStates[viewingGameStateIdx].getReasonIfInvalid(currentGameConfig, p)) || (!p.hideWhenInvalid));
				
				var yPos = 0;
                const alterUnitMenuWidth = ((dualLanguage ? 9 : 6) + (possibleActions.some(p => p.action == ACT_BUILD) ? 5 : 0)) * TILE_SIZE; //Wider when dual-language mode is active, and even more wider when there are upgrades available
                const maxAlterMenuTextWidth = alterUnitMenuWidth - TILE_SIZE - 4;
				for (var x = 0; x < possibleActions.length; x++) {
					let delta = possibleActions[x];
					var label = languageSwitch(delta, "text", language, dualLanguage);
                    shownMenu.elem.insertAdjacentHTML("beforeend", `<g transform="translate(0,${yPos + TILE_SIZE})"><rect width="${alterUnitMenuWidth}" height="${TILE_SIZE}" fill="#171717" stroke-width="0" /><text x="${TILE_SIZE + 2}" y="${TILE_SIZE / 2}" dominant-baseline="central" lengthAdjust="spacingAndGlyphs">${label}</text></g>`);
                    if (shownMenu.elem.lastElementChild.lastElementChild.getBBox().width > maxAlterMenuTextWidth) shownMenu.elem.lastElementChild.lastElementChild.setAttribute("textLength", maxAlterMenuTextWidth);

					if (!delta.reason) {
						shownMenu.elem.lastElementChild.onmousedown = (event) => {
							if (event.button) return;
							if (!gameStates[viewingGameStateIdx].getReasonIfInvalid(currentGameConfig, delta)) {
								shownMenu.close();
								gameStates[viewingGameStateIdx].update(currentGameConfig, delta);
								if (turnEndingActions.includes(delta.action)) clientAdvanceTurn();
								else updateDisplay();
							}
							event.stopPropagation();
							event.preventDefault();
						};
					}

					var thisMenuItemHeight = TILE_SIZE;
					if (delta.action == ACT_DEMOLISH) {
						//What are we demolishing?
						var unit = state.units.find(p => p.x == delta.x && p.y == delta.y && p.playerIdx == delta.playerIdx);
						if (!unit) unit = state.units.find(p => p.x == delta.x && p.y == delta.y && p.playerIdx == NEUTRAL_PLAYER && !unitDefinitions[p.unitDefID].invulnerable); //Check if it's a neutral unit (obviously not allowed to be indestructible)

						if (unit) thisMenuItemHeight = menuAddResourceDeltaInfo(true, [{ unitDefID: unit.unitDefID, x: delta.x, y: delta.y }], alterUnitMenuWidth, thisMenuItemHeight);
					} else if (delta.action == ACT_BUILD) { //An upgrade
						//TODO: Need the unit icon (also would prefer to have icons for enable, disable, and demolish, but they're slightly less important)
						var unit = state.units.find(p => p.x == delta.x && p.y == delta.y && p.playerIdx == delta.playerIdx && p.unitDefID == delta.upgradeFrom);
						thisMenuItemHeight = menuAddResourceDeltaInfo(false, [{ unitDefID: delta.unitDefID, x: delta.x, y: delta.y }], alterUnitMenuWidth, thisMenuItemHeight, -1, unit.wasActiveAtTurnStart);
                    }

					//Display reason if it's not allowed
                    if (delta.reason) {
                        //newSprite.querySelector("image").setAttribute("filter", `url(#fcat${CAT_HUD})`); //Grayscale //I don't have a sprite for demolition at the moment
                        //newSprite.setAttribute("filter", `url(#ftier0)`); //The darkest color
                        shownMenu.elem.lastElementChild.querySelector("text").style.fill = "#999"; //Gray text

						if (!delta.reason.hide) { //Don't waste space showing the 'Insufficient resources.' reason because we already have a colorized resource icon for that.
							shownMenu.elem.lastElementChild.insertAdjacentHTML("beforeend", `<text style="fill:#c00" y="${thisMenuItemHeight + TILE_SIZE / 2}">${languageSwitch(delta.reason, "text", language, dualLanguage)}</text>`);
                            thisMenuItemHeight += wrapSvgText(shownMenu.elem.lastElementChild.lastElementChild, 2, alterUnitMenuWidth, 24, 3, languageSwitch(delta.reason, "text", language, dualLanguage)) + 4;
						}
					}
                    shownMenu.elem.lastElementChild.querySelector("rect").setAttribute("height", thisMenuItemHeight);
                    yPos += thisMenuItemHeight;
				}

				if (!possibleActions.length) {
					shownMenu.elem.insertAdjacentHTML("beforeend", `<g transform="translate(0,${TILE_SIZE})"><rect width="${alterUnitMenuWidth}" height="${TILE_SIZE}" fill="#171717" stroke-width="0" /><text x="${TILE_SIZE+2}" y="${TILE_SIZE/2}" dominant-baseline="central" lengthAdjust="spacingAndGlyphs">(${languageSwitch({t: "No actions", tJP: "制御なし"}, "t", language, dualLanguage)})</text></g>`);
                    if (shownMenu.elem.lastElementChild.lastElementChild.getBBox().width > maxAlterMenuTextWidth) shownMenu.elem.lastElementChild.lastElementChild.setAttribute("textLength", maxAlterMenuTextWidth);
				}
                shownMenu.width = alterUnitMenuWidth;
                shownMenu.height = yPos || TILE_SIZE; //height of the part below the highlighted square, anyway
			}
		} else if (shownMenu.type == "multiConstruct") {
            shownMenu.elem.style.cursor = "pointer";
			shownMenu.elem.replaceChildren([]);
			//Calculate the max number of this unit we can build based on resources (Math.floor for affordable whole numbers only) and the value of multiConstruct. This should have already been verified to be >= 1 //TODO: unless the game state changed while the menu was open
            const maxCount = unitDefinitions[shownMenu.unitDefID].cost.reduce((smallestYet, currentCost, idx) => Math.min(smallestYet, Math.floor((currentCost || 0) < 1 ? 99 : (player.resources[idx] / currentCost))), unitDefinitions[shownMenu.unitDefID].multiConstruct);

			//Calculate pseudo-menu bounds and dimensions
            const minX = Math.max(0, shownMenu.x - maxCount + 1); //so the point the player originally clicked would be at (shownMenu.x - minX, shownMenu.y - minY) relative to shownMenu.elem's transform
            const minY = Math.max(0, shownMenu.y - maxCount + 1);
            const width = Math.min(currentGameConfig.w, shownMenu.x + maxCount) - minX;
            const height = Math.min(currentGameConfig.h, shownMenu.y + maxCount) - minY;
			shownMenu.elem.setAttribute("transform", `translate(${minX * TILE_SIZE},${minY * TILE_SIZE})`);

			//Determine buildability by looping through units once to build a positional matrix rather than looping through the units on every iteration
			//Also shouldn't highlight any squares that are not 'reachable' from your current buildings (based on blockers, just like with mining and such), so we start with player.buildabilityMatrix to accomplish that.
			if (!player.buildabilityMatrix) player.buildabilityMatrix = getBuildableLocationsForPlayer(currentGameConfig, state, viewAsPlayerIdx); //Calculate if missing when needed
			var buildabilityMatrix = player.buildabilityMatrix.slice(); //Clone the player's buildability matrix, but we'll make the tiles with units not buildable, too
            for (var x = 0; x < state.units.length; x++) buildabilityMatrix[state.units[x].x + state.units[x].y * currentGameConfig.w] = false; //assuming this unit can't be built on any other units

			//If there's only one buildable slot anyway, go ahead and show the Confirm button assuming that the player will build the one unit.
			if (width == 1 && buildabilityMatrix[minX + minY * currentGameConfig.w]) {
				shownMenu.confirmingX = shownMenu.x;
				shownMenu.confirmingY = shownMenu.y;
            }

			//Draw a tentative copy of the unit in the clicked square at (shownMenu.x, .y)
			addSprite(shownMenu.elem, (shownMenu.x - minX) * TILE_SIZE, (shownMenu.y - minY) * TILE_SIZE, unitDefinitions[shownMenu.unitDefID]);
			var confirmingTiles = [];
			if (shownMenu.confirmingX !== undefined) {
				//Draw a tentative copy of all the units that would be built (so this code should match GameState.update() for ACT_LINE_BUILD pretty closely)
				var stillBuildableAtEndpoint = false;
				var tiles = vectorToTiles(shownMenu.x, shownMenu.y, shownMenu.confirmingX, shownMenu.confirmingY);
				for (var x = 0; x < tiles.length; x++) {
					var tempDelta = { action: ACT_BUILD, x: tiles[x].x, y: tiles[x].y, playerIdx: viewAsPlayerIdx, unitDefID: shownMenu.unitDefID };
					if (!gameStates[viewingGameStateIdx].getReasonIfInvalid(currentGameConfig, tempDelta)) { //Use the standard validity check to see if this tile is buildable
						addSprite(shownMenu.elem, (tempDelta.x - minX) * TILE_SIZE, (tempDelta.y - minY) * TILE_SIZE, unitDefinitions[shownMenu.unitDefID]);
						if (tempDelta.x == shownMenu.confirmingX && tempDelta.y == shownMenu.confirmingY) stillBuildableAtEndpoint = true;
						confirmingTiles.push({ unitDefID: shownMenu.unitDefID, x: tempDelta.x, y: tempDelta.y });
					}
				}
				if (!stillBuildableAtEndpoint || !confirmingTiles.length) shownMenu.confirmingX = shownMenu.confirmingY = undefined; //Don't show the confirmation highlight square anymore because it's no longer a valid move
				else {
					//Show a confirm button and resource gains/losses like in the usual unit build/upgrade menu
					var confirmAreaWidth = Math.max(width, dualLanguage ? 5 : 4) * TILE_SIZE;
					var label = languageSwitch({text: "Confirm", textJP: "確認"}, "text", language, dualLanguage);
					shownMenu.elem.insertAdjacentHTML("beforeend", `<g transform="translate(0,${height * TILE_SIZE})"><rect width="${confirmAreaWidth}" height="${TILE_SIZE}" fill="#171717" stroke-width="0" /><text x="${2}" y="${TILE_SIZE / 2}" dominant-baseline="central" lengthAdjust="spacingAndGlyphs">${label}</text></g>`);
					if (shownMenu.elem.lastElementChild.lastElementChild.getBBox().width > confirmAreaWidth - 4) shownMenu.elem.lastElementChild.lastElementChild.setAttribute("textLength", confirmAreaWidth - 4);
					var resourceMenuSectionHeight = menuAddResourceDeltaInfo(false, confirmingTiles, confirmAreaWidth, TILE_SIZE);
					shownMenu.elem.lastElementChild.firstElementChild.setAttribute("height", resourceMenuSectionHeight);
					shownMenu.elem.lastElementChild.onmousedown = (event) => { //If you click the Confirm area, it should complete the build in the displayed line.
						if (event.button) return;
						gameStates[viewingGameStateIdx].update(currentGameConfig, { playerIdx: viewAsPlayerIdx, action: ACT_LINE_BUILD, unitDefID: shownMenu.unitDefID, x: shownMenu.x, y: shownMenu.y, endX: shownMenu.confirmingX, endY: shownMenu.confirmingY });
						shownMenu.close(event);
						clientAdvanceTurn(); //Line builds end the turn
					};
					//TODO: Move it around as needed--probably just right above or right below the highlighted area; probably only move it up to -resourceMenuSectionHeight if it's partially or completely covered by the HUD
				}
            }
			//Highlight every square around (and on top of) the clicked square
			for (var x = 0; x < width; x ++) {
                for (var y = 0; y < height; y ++) {
					shownMenu.elem.insertAdjacentHTML("beforeend", `<rect width="${TILE_SIZE}" height="${TILE_SIZE}" transform="translate(${x*TILE_SIZE},${y*TILE_SIZE})" fill="rgba(255,255,0,0.5)" stroke-width="0" />`); //Construction area highlight
					if (buildabilityMatrix[minX + x + (minY + y) * currentGameConfig.w]) { //If it's a buildable location, make the normal highlight there clickable to build
						//The delta should be a unit type and positioned vector (magnitude being a count in terms of tiles; the highlighted area is a 9x9 square if multiConstruct=5) for easier checks. If another unit is in the way, it's skipped but counted toward the length.
						let delta = { playerIdx: viewAsPlayerIdx, action: ACT_LINE_BUILD, unitDefID: shownMenu.unitDefID, x: shownMenu.x, y: shownMenu.y, endX: minX + x, endY: minY + y };
						if (confirmingTiles.find(p => p.x == delta.endX && p.y == delta.endY)) shownMenu.elem.lastElementChild.setAttribute("fill", "rgba(32,96,48,0.5)"); //Show the tile in green to indicate that you need to confirm the construction of the displayed line of units
						shownMenu.elem.lastElementChild.onmousedown = (event) => {
							if (event.button) return;
							if (!gameStates[viewingGameStateIdx].getReasonIfInvalid(currentGameConfig, delta)) {
								shownMenu.confirmingX = delta.endX; //Clicking in the yellow highlighted area is just visual; you gotta click the Confirm button to actually build
								shownMenu.confirmingY = delta.endY;
								updateMenu();
							}
							event.stopPropagation();
							event.preventDefault();
						};
					} else shownMenu.elem.lastElementChild.setAttribute("fill", "rgba(64,32,32,0.5)"); //reddish-gray out spots where you can't build in this range (clicking will close the pseudo-menu, canceling the construction)
                }
			}
			shownMenu.width = shownMenu.height = 0; //Shouldn't move the menu to keep it on-screen, so unset the width/height
		} else if (shownMenu.type == "info") {
			const listInnerWidth = 200;
			const listInnerHeight = gameView.viewBox.baseVal.height - hud.height - 32; //The 32 is arbitrary based on the top and bottom padding and border thickness. I just wanna make it look good!
			const listBorderWidth = 8;
			if (!shownMenu.elem.firstElementChild) {
				//Draw a box over nearly the whole screen that ignores scrolling, like a DOM element with position: fixed
				shownMenu.elem.insertAdjacentHTML("beforeend", `<rect fill="rgba(50,50,50,1)" stroke-width="0" />`); //The info window

                //Outline/backdrop for the scrollable list (but not inside it)
                shownMenu.elem.insertAdjacentHTML("beforeend", `<rect x="${16}" y="${16}" width="${listInnerWidth}" paint-order="stroke fill" stroke="rgba(80,80,80,1)" fill="rgba(20,20,20,1)" stroke-width="${listBorderWidth}" />`);
				shownMenu.scrollListBox = shownMenu.elem.lastElementChild;
                shownMenu.elem.insertAdjacentHTML("beforeend", `<g transform="translate(${16},${16})" clip-path="url(#scrollListClipPath)" style="cursor:pointer;" />`); //The clip path so that nothing bleeds out of the inner part of the scroll list
				shownMenu.elem.lastElementChild.insertAdjacentHTML("beforeend", "<g />"); //The actual scrollable area of the list
                shownMenu.scrollList = shownMenu.elem.lastElementChild.lastElementChild;
				shownMenu.listScroll = shownMenu.descriptionScroll = shownMenu.descriptionScrollMax = 0;

				const maxListTextWidth = listInnerWidth - 6 - TILE_SIZE; //2 for padding to the left of the icon, 2 for padding between the icon and text, and 2 for padding to the right of the text
				shownMenu.scrollListContentHeight = 2; //two pixels for padding
				for (var x = 0; x < unitDefinitions.length; x++) {
					if (unitDefinitions[x].description) {
						let unitDef = unitDefinitions[x];
                        shownMenu.scrollList.insertAdjacentHTML("beforeEnd", `<g transform="translate(2,${shownMenu.scrollListContentHeight})" />`);
						let listItemGroup = shownMenu.scrollList.lastElementChild;
                        listItemGroup.insertAdjacentHTML("beforeend", `<rect x="-2" y="-2" width="${listInnerWidth}" height="${TILE_SIZE+2}" stroke-width="0" />`); //A backdrop so that click events can be caught easily
                        addSprite(listItemGroup, 0, 0, unitDefinitions[x]); //Show the normal in-game image for that unit (or resource, or any other icon that happens to have a description, regardless of whether it's set to hidden normally)
						listItemGroup.insertAdjacentHTML("beforeEnd", `<text x="${TILE_SIZE+2}" y="${TILE_SIZE/2}" dominant-baseline="central" lengthAdjust="spacingAndGlyphs">${languageSwitch(unitDefinitions[x], "name", language)}</text>`); //Doesn't allow dual language due to space
                        if (listItemGroup.lastElementChild.getBBox().width > maxListTextWidth) listItemGroup.lastElementChild.setAttribute("textLength", maxListTextWidth); //Keep the text small enough

						listItemGroup.onmousedown = (event) => {
							if (event.button != 0) return;
							shownMenu.nameText = languageSwitch(unitDef, "name", language, dualLanguage, " / ");
                            shownMenu.descriptionArea.firstElementChild.innerText = shownMenu.descriptionArea.lastElementChild.innerText = languageSwitch(unitDef, "description", language, dualLanguage, "\n\n"); //Both spans need updated
							[...shownMenu.scrollList.querySelectorAll("[fill]")].forEach(p => p.removeAttribute("fill")); //Remove highlighting from all the list items
							listItemGroup.firstElementChild.setAttribute("fill", "rgba(50,50,50,1)"); //and then highlight just this one

							updateMenu(); //because the nameText needs word-wrapped and the description area scroll max may need to change
							event.preventDefault();
							event.stopPropagation();
						};

                        shownMenu.scrollListContentHeight += TILE_SIZE + 2; //two pixels for padding
                    }
				}

                shownMenu.elem.insertAdjacentHTML("beforeend", `<text text-anchor="middle" y="20" style="font-size:20px;" />`);
				shownMenu.nameArea = shownMenu.elem.lastElementChild;
                shownMenu.elem.insertAdjacentHTML("beforeend", `<foreignObject y="80"><span xmlns="http://www.w3.org/1999/xhtml" style="-webkit-text-stroke: 3px #000;word-break: break-word;position: absolute;font-size: 18px;"></span><span xmlns="http://www.w3.org/1999/xhtml" style="color: #f80;word-break: break-word;position: absolute;font-size: 18px;"></span></foreignObject>`);
                shownMenu.descriptionArea = shownMenu.elem.lastElementChild;
			}

			//Keep the info 'window' fixed positioned and sized relative to the viewport
            shownMenu.elem.setAttribute("transform", `translate(${scrollX},${scrollY})`);
			shownMenu.elem.firstElementChild.setAttribute("width", gameView.viewBox.baseVal.width); //The info window itself
			shownMenu.elem.firstElementChild.setAttribute("height", gameView.viewBox.baseVal.height - hud.height);
			shownMenu.scrollListBox.setAttribute("height", listInnerHeight);

			const descriptionAreaWidth = gameView.viewBox.baseVal.width - listInnerWidth - listBorderWidth * 5; //a little padding on the right, so one extra listBorderWidth worth
			var nameAreaCenterX = (gameView.viewBox.baseVal.width + listInnerWidth + listBorderWidth * 2) / 2; //Centered in the area that *isn't* covered by the list
			shownMenu.nameArea.removeAttribute("textLength");
			wrapSvgText(shownMenu.nameArea, 0, descriptionAreaWidth, 30, 3, shownMenu.nameText);
			[...shownMenu.nameArea.children, shownMenu.nameArea].forEach(p => p.setAttribute("x", nameAreaCenterX)); //All the text needs to be centered

			const descriptionAreaHeight = gameView.viewBox.baseVal.height - hud.height - 80 - 20;
			shownMenu.descriptionArea.setAttribute("x", listInnerWidth + listBorderWidth * 4);
			shownMenu.descriptionArea.setAttribute("width", descriptionAreaWidth);
			shownMenu.descriptionArea.setAttribute("height", descriptionAreaHeight);
			gameView.getElementById("scrollListPath").setAttribute("d", `M0,0 0,${listInnerHeight} ${listInnerWidth},${listInnerHeight} ${listInnerWidth},0z`);

			//List scrolling
            shownMenu.listScrollMax = Math.max(0, shownMenu.scrollListContentHeight - listInnerHeight); //in pixels
			shownMenu.listScroll = Math.min(shownMenu.listScroll, shownMenu.listScrollMax);
			shownMenu.scrollList.setAttribute("transform", `translate(0,${-shownMenu.listScroll})`);

			//Description area scrolling
			shownMenu.descriptionScrollMax = Math.max(0, shownMenu.descriptionArea.querySelector("span").clientHeight - descriptionAreaHeight);
			shownMenu.descriptionScroll = Math.min(shownMenu.descriptionScroll, shownMenu.descriptionScrollMax);
			[...shownMenu.descriptionArea.querySelectorAll("span")].forEach(p => p.style.top = -shownMenu.descriptionScroll + "px")


			//TODO: put an OK/Close button at the bottom of the box
		} else if (shownMenu.type == "simpleNotice") {
			const padding = 20;
			var textAreaWidth = (gameView.clientWidth - padding * 2) / displayScale;
			const textAreaHeight = (gameView.clientHeight - hud.height - padding * 2) / displayScale;
			if (!shownMenu.elem.firstElementChild) {
                shownMenu.elem.insertAdjacentHTML("beforeend", `<foreignObject><span xmlns="http://www.w3.org/1999/xhtml" style="-webkit-text-stroke: 3px #000;word-break: break-word;position: absolute;font-size: 24px;background-color:rgb(50,50,50);padding:${padding}px;"></span><span xmlns="http://www.w3.org/1999/xhtml" style="color: #f80;word-break: break-word;position: absolute;font-size: 24px;padding:${padding}px;"></span></foreignObject>`);
                shownMenu.elem.firstElementChild.firstElementChild.innerText = shownMenu.elem.firstElementChild.lastElementChild.innerText = languageSwitch(shownMenu, "text", language, dualLanguage, "\n\n"); //Both spans need updated
			}

            //Make it a little narrower if it's super wide and super short
            shownMenu.elem.firstElementChild.setAttribute("width", textAreaWidth);
            var aspectRatio = shownMenu.elem.firstElementChild.firstElementChild.clientHeight / Math.max(1, shownMenu.elem.firstElementChild.firstElementChild.clientWidth);
            if (aspectRatio < 0.05) textAreaWidth *= 0.35;
            else if (aspectRatio < 0.1) textAreaWidth *= 0.5;
            else if (aspectRatio < 0.2) textAreaWidth *= 0.8;

            shownMenu.elem.setAttribute("transform", `translate(${scrollX},${scrollY})`);
            shownMenu.elem.firstElementChild.setAttribute("width", textAreaWidth);
			shownMenu.elem.firstElementChild.setAttribute("height", textAreaHeight);

            //Fix the X position because the text can't be centered through other means
			shownMenu.elem.firstElementChild.setAttribute("x", (gameView.clientWidth / displayScale - shownMenu.elem.firstElementChild.firstElementChild.clientWidth) / 2);

			//Vertically center if there's space to do so
			if (shownMenu.elem.firstElementChild.firstElementChild.clientHeight < textAreaHeight) {
				shownMenu.elem.firstElementChild.setAttribute("y", ((gameView.clientHeight - hud.height) / displayScale - shownMenu.elem.firstElementChild.firstElementChild.clientHeight) / 2);
				shownMenu.elem.firstElementChild.setAttribute("height", shownMenu.elem.firstElementChild.firstElementChild.clientHeight + padding * 2 / displayScale); //Not necessary, but just so it looks cleaner and I don't get confused when I inspect it
			}

			shownMenu.textScrollMax = Math.max(0, shownMenu.elem.firstElementChild.querySelector("span").clientHeight - textAreaHeight);
            shownMenu.textScroll = Math.min(shownMenu.textScroll || 0, shownMenu.textScrollMax);
			[...shownMenu.elem.firstElementChild.querySelectorAll("span")].forEach(p => p.style.top = -shownMenu.textScroll + "px")
		}

		//Adjust the menu location to make sure it stays on-screen
		if (shownMenu.width) {
			var flipX = (shownMenu.width + shownMenu.x * TILE_SIZE > gameView.clientWidth / displayScale + scrollX);
			var flipY = (shownMenu.height + TILE_SIZE + shownMenu.y * TILE_SIZE > gameView.clientHeight / displayScale - hud.height + scrollY);
			var menuX = shownMenu.x * TILE_SIZE - (flipX ? shownMenu.width - TILE_SIZE : 0);
			var menuY = shownMenu.y * TILE_SIZE - (flipY ? shownMenu.height + TILE_SIZE : 0);
			var highlightSquareX = flipX ? shownMenu.width - TILE_SIZE : 0;
			var highlightSquareY = flipY ? shownMenu.height + TILE_SIZE : 0;

			//If some of the text would be out of view because the highlight square is at least partially out of view (or completely out of view and then some, in the Y axis case), move the highlight square within the menu and move the menu in the opposite direction the same amount
			var diff;
			if ((diff = shownMenu.x * TILE_SIZE - scrollX) < 0 || (diff = shownMenu.x * TILE_SIZE + TILE_SIZE - scrollX - gameView.clientWidth / displayScale) > 0) { //If we're off-screen to the left or off-screen to the right, diff gets set to an appropriate adjustment amount
				menuX -= diff;
				highlightSquareX += diff;
            }
			if ((diff = shownMenu.y * TILE_SIZE - scrollY + TILE_SIZE) < 0 || (diff = shownMenu.y * TILE_SIZE + hud.height - scrollY - gameView.clientHeight / displayScale) > 0) { //Same deal for the Y axis
                menuY -= diff;
				highlightSquareY += diff;
            }

			//If the menu is off-screen after all that, then let's just force the menu to be aligned with the left edge of the viewable screen area. This should only happen on very small screens.
			if (menuX - scrollX < 0 || menuX + shownMenu.width - scrollX - gameView.clientWidth / displayScale > 0) {
				highlightSquareX += menuX; //make it relative to the map temporarily
				menuX = scrollX;
				highlightSquareX -= menuX; //switch it back to relative to the menu
			}
			if (menuY - scrollY < 0 || menuY + shownMenu.height - scrollY - gameView.clientHeight / displayScale > 0) {
				highlightSquareY += menuY; //make it relative to the map temporarily
				menuY = scrollY - TILE_SIZE; //we actually show the menu 1 tile below the highlighted square normally
				highlightSquareY -= menuY; //switch it back to relative to the menu
			}

            shownMenu.elem.setAttribute("transform", `translate(${menuX},${menuY})`);
            shownMenu.elem.firstElementChild.setAttribute("x", highlightSquareX);
            shownMenu.elem.firstElementChild.setAttribute("y", highlightSquareY);
        }
	}
}

function menuAddResourceDeltaInfo(forDemolish, units /*array of objects where each object should have x, y, and unitDefID*/, menuWidth, yPos /*starting Y-position*/, onUnitDefID = -1 /*only needed for resource producers now*/, upgradingActiveUnit = false) { //Returns the height of the resource delta info (0 if none was displayed)
	var state = gameStates[viewingGameStateIdx];
    const resourceSpriteScale = 0.75;
    const standardResourceRowHeight = TILE_SIZE * resourceSpriteScale + 4;
    //Add consumption/production information
    var xPos = 10; //Some left-side padding
	var anyResource = false; //determines if we need to add vertical space because we added at least part of a row of resource info
	var unitType = unitDefinitions[units[0].unitDefID]; //Any given units are expected to all be the same unit type.
	if (upgradingActiveUnit) unitType = addParentActiveCostToUpgrade(unitType); //Always include the parent's active cost it if you're upgrading a unit that was active at the start of the turn.
	else if (forDemolish) unitType = addParentConstructionCostToUpgrade(unitType); //Always include the parent's cost in the refund if it's an upgrade

	units.forEach(p => p.isActive = true); //Affects the input array, but it shouldn't matter. It's needed for the Military Readiness and Command resources to calculate correctly.

    function addIconAndAdvancePosition(resourceDefinitionIndex, isErrorState) {
        var resourceTextWidth = shownMenu.elem.lastElementChild.lastElementChild.getBBox().width;
        if (resourceTextWidth + xPos + 4 + TILE_SIZE * resourceSpriteScale > menuWidth) {
            yPos += standardResourceRowHeight;
            xPos = 10; //Same left-side padding
        }
        shownMenu.elem.lastElementChild.lastElementChild.setAttribute("x", xPos + 4 + TILE_SIZE * resourceSpriteScale);
        shownMenu.elem.lastElementChild.lastElementChild.setAttribute("y", yPos + resourceSpriteScale * TILE_SIZE / 2 + 5); //vertically centered with the resource icon, after all

        var newResourceSprite = addSprite(shownMenu.elem.lastElementChild, 0, 0, resourceDefinitions[resourceDefinitionIndex]);
		newResourceSprite.setAttribute("transform", `translate(${xPos},${yPos}) scale(${resourceSpriteScale}) ` + newResourceSprite.getAttribute("transform"));

		//Make the icon red if desired
        if (isErrorState) newResourceSprite.querySelector("image").setAttribute("filter", `url(#fcat${CAT_ERRORS})`);
        xPos += resourceTextWidth + 4 + TILE_SIZE * resourceSpriteScale + 8; //8 - extra padding between resources
    }

	if (forDemolish && unitType.demoCost !== 0) {
		//Draw the demoCost (but always negative) as RES_EXPLOSIVES like the below loop would
		anyResource = true;
        shownMenu.elem.lastElementChild.insertAdjacentHTML("beforeend", `<text style="fill:#f60">${-(unitType.demoCost || 1)}</text>`);

        addIconAndAdvancePosition(RES_EXPLOSIVES, state.players[viewAsPlayerIdx].resources[RES_EXPLOSIVES] < (unitType.demoCost || 1));
    }

	for (var y = 0; y < resourceDefinitions.length; y++) {
		if (forDemolish && !resourceDefinitions[y].refundRate) continue; //Don't show this kind of display for non-refundable resources

        var cost = -((unitType.cost || [])[y] || 0) * units.length; //Negate it so it's positive for production and negative for costs when displaying, so we're really calculating and showing the "change in resource amount"
		var activeCost = -((unitType.activeCost || [])[y] || 0) * units.length;

		if (unitType.mustBuildOn && activeCost > 0) { //Make the Drill Site and Deep Mine numbers represent reality--they're technically multipliers for the resourceSupply of the units that they have to be built on.
            if (onUnitDefID != -1) { //If it's actually being built on one of those units, we need to show the ACTUAL amount, not the POSSIBLE amount.
				if (unitDefinitions[onUnitDefID].resourceSupply && unitDefinitions[onUnitDefID].resourceSupply[y]) activeCost *= unitDefinitions[onUnitDefID].resourceSupply[y];
				else activeCost = 0;
            } else {
				var possibleAmounts = unitType.mustBuildOn.map(p => unitDefinitions[p]).filter(p => p.resourceSupply && p.resourceSupply[y]).map(p => p.resourceSupply[y]);
				if (possibleAmounts.length == 1) activeCost = "<=" + (activeCost * possibleAmounts[0]); //Could add a "?" or "<=" or whatever to it here, changing it to a string; it'll still be colorized as if it were positive
				else activeCost = 0;
				//If I were to make multiple different units with different amounts of this resource, here I would have to get the min and max to display.
			}
        }

		if (forDemolish) { //This loop is only for showing refunds when demolishing.
			cost = Math.floor(-cost * resourceDefinitions[y].refundRate); //Negate again so it's positive for what *was* a cost and is now a refund. Floor because that's how GameState.update() works for refunds.
			if (cost <= 0) continue; //But if it's negative now, that means you were awarded with this resource for costructing the unit, and a refund is illogical. (You wouldn't recieve a resource for constructing a unit anyway.) If it's 0, we don't want the icon/number anyway.
        }

        //If this unit is in the Command category and we're calculating the Command resource, we have to calculate with a special function based on the player's units.
		if (y == RES_COMMAND && unitType.category == CAT_COMMAND) {
			var playerUnits = state.units.filter(p => p.playerIdx == viewAsPlayerIdx && unitDefinitions[p.unitDefID].category == CAT_COMMAND);
			var actual = state.players[0].resources[RES_COMMAND] || calculateCommandResource(playerUnits);
			var potential = calculateCommandResource(playerUnits.concat(units));
			activeCost = potential - actual;
		} else if (y == RES_READINESS) {
			var actual = state.players[0].resources[RES_READINESS] || 0; //TODO: need to calculate resources at the start of turn 0
			//TODO: It'd be simpler (and would certainly be just as accurate, if not more so) to just simulate the next game state with and without the given units and spit out the difference.
			if (units[0].unitDefID == UNIT_SOLAR_PANELS) { //Solar panels are treated as a special case for the time being.
				var tempPlayers = state.players.map(p => new PlayerState(p));
				tempPlayers.forEach((p, idx) => {
					p.resourcesProduced = state.players[idx].resourcesProduced.slice();
					p.resourcesConsumed = state.players[idx].resourcesConsumed.slice();
				});
				tempPlayers[viewAsPlayerIdx].resourcesProduced[RES_ELECTRICITY] += unitType.activeCost[RES_ELECTRICITY] * units.length;
			}
			
			var potential = calculateMilitaryReadiness(currentGameConfig, state.units.slice().concat(units), tempPlayers || state.players);
			activeCost = potential - actual;
        }

        if (cost || activeCost) {
            anyResource = true;
            //Add the text before the icon, so if it's too wide, we can move it down before adding the icon
            if (forDemolish) shownMenu.elem.lastElementChild.insertAdjacentHTML("beforeend", `<text style="fill:#3ff">${cost}</text>`); //Demolition doesn't need two numbers since this loop is only for refunds in that case
            else shownMenu.elem.lastElementChild.insertAdjacentHTML("beforeend", `<text><tspan style="fill:#${cost == 0 ? '999' : cost < 0 ? 'f60' : '3ff'}">${cost}</tspan><tspan style="fill:#999">|</tspan><tspan style="fill:#${activeCost == 0 ? '999' : activeCost < 0 ? 'f60' : '3ff'}">${activeCost}</tspan></text>`);

            addIconAndAdvancePosition(y, (cost < 0 && cost + state.players[viewAsPlayerIdx].resources[y] < 0));
        }
    }
    return (anyResource ? standardResourceRowHeight : 0) + yPos;
}

function updateDisplay(advancingTurn) {
	var state = gameStates[viewingGameStateIdx]; //Aliases for shorter code
	var player = state.players[viewAsPlayerIdx];
	
    updateHUD();
	
	//Add or update displayed sprites for all units based on the current state
	//TODO: If the player specifically asked to see a previous state, hide sprites that aren't referenced in that turn. (switchPlayer() and switchToGame() normally take care of it)
	for (var x = 0; x < state.units.length; x++) {
		var unit = state.units[x];
		if (!unit.sprite) {
			unit.sprite = addSprite(mapGroup, unit.x * TILE_SIZE, unit.y * TILE_SIZE, unitDefinitions[unit.unitDefID], true);
			if (!unitDefinitions.some(p => p.mustBuildOn && p.mustBuildOn.includes(unit.unitDefID))) unit.sprite.onmousedown = (event) => mouseDownHandler(event, "alterUnit"); //Demolish/enable/disable menu. Also prevents opening the construction menu.

			//Include the player's name in the tooltip for other players' units
			if (unit.playerIdx == NEUTRAL_PLAYER) unit.sprite.firstElementChild.insertAdjacentHTML('beforeend', "<title>" + languageSwitch({ text: "Natural Resource", textJP: "天然資源" }, "text", language, dualLanguage) + "</title>");
			else if (unit.playerIdx != viewAsPlayerIdx) unit.sprite.firstElementChild.insertAdjacentHTML('beforeend', `<title>${state.players[unit.playerIdx].name}</title>`);
		}
		else updateSprite(unit.sprite, unit.x * TILE_SIZE, unit.y * TILE_SIZE, unitDefinitions[unit.unitDefID]);
		if (desaturateAlliedUnits && unit.playerIdx != viewAsPlayerIdx && unit.playerIdx != NEUTRAL_PLAYER) unit.sprite.setAttribute("filter", "url(#allycolor)");
		else unit.sprite.removeAttribute("filter");

        unit.sprite.replaceChildren(unit.sprite.firstElementChild); //Remove any overlays
		if (unit.disabled && unit.playerIdx == viewAsPlayerIdx) { //No overlays for allies' units
			addSprite(unit.sprite, 0, 0, unitDefinitions[UNIT_DISABLED]);
		} else if (unit.isActive === false && unit.playerIdx == viewAsPlayerIdx) { //Add an overlay for deactivation due to insufficient resources
			addSprite(unit.sprite, 0, 0, unitDefinitions[UNIT_INSUFFICIENT_RESOURCES]);
		}
	}

    updateMenu(advancingTurn);
}

function showInfoWindow() {
	if (shownMenu) shownMenu.close();
    shownMenu = new MapCoordMenu("info", 0, 0);
    updateMenu();
}

function makePoster() { //Save an image of the full gameplay area, regardless of your screen size; named thusly in honor of Total Annihilation. :P
	if (shownMenu) shownMenu.close(); //Can't show text when testing locally, at least. Loading the font counts like accessing another domain, so the CORS policy breaks it.
    //Tweak the SVG for rendering purposes
    var w = (currentGameConfig.w * TILE_SIZE);
    var h = (currentGameConfig.h * TILE_SIZE);
    gameView.setAttribute("viewBox", "0 0 " + w + " " + h);
    gameView.setAttribute("width", w);
    gameView.setAttribute("height", h);
    hudGroup.style.display = "none";

    //Save as image file
    var blob = new Blob([new XMLSerializer().serializeToString(gameView)], { type: 'image/svg+xml;charset=utf-8' });
    var image = new Image();
    image.onload = () => {
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, w, h);
        var png = canvas.toDataURL();

        var link = document.createElement('a');
        link.download = "BurgustarScreenshot.png";
        link.href = png;
        document.body.append(link);
        link.click();
        link.remove();

        //Undo stuff 
        gameView.removeAttribute("width");
        gameView.removeAttribute("height");
        hudGroup.style.display = "";
        document.body.onresize();
    };
    image.src = URL.createObjectURL(blob);
}

function scroll(direction /*0 through 7 with 0 being due east and 2 being due north*/) {
	var xOff = 0, yOff = 0;
	if (direction == 7 || direction < 2 && scrollX < TILE_SIZE * currentGameConfig.w) xOff = TILE_SIZE;
	else if (direction > 2 && direction < 6 && scrollX > -TILE_SIZE * 2) xOff = -TILE_SIZE;

    if (direction > 4 && scrollY < TILE_SIZE * currentGameConfig.h) yOff = TILE_SIZE;
	else if (direction > 0 && direction < 4 && scrollY > -TILE_SIZE * 2) yOff = -TILE_SIZE;

	if (xOff || yOff) {
		scrollX += xOff;
		scrollY += yOff;
		document.body.onresize();
	}
}

function setResetBorders() {
	//Add borders to the gameplay area so the player can easily see why they're not actually allowed to build there despite being able to scroll that far for convenience
	if (!mapGroup.firstElementChild) {
		mapGroup.insertAdjacentHTML("beforeend", `<rect fill="black" />`);
		mapGroup.insertAdjacentHTML("beforeend", `<rect fill="black" />`);
		mapGroup.insertAdjacentHTML("beforeend", `<rect fill="black" />`);
		mapGroup.insertAdjacentHTML("beforeend", `<rect fill="black" />`);
	}
	mapGroup.children[0].setAttribute("x", -TILE_SIZE * 2);
	mapGroup.children[1].setAttribute("x", -TILE_SIZE * 2);
	mapGroup.children[2].setAttribute("x", -TILE_SIZE * 2);
	mapGroup.children[3].setAttribute("x", currentGameConfig.w * TILE_SIZE);
	mapGroup.children[0].setAttribute("y", -TILE_SIZE * 2);
	mapGroup.children[1].setAttribute("y", -TILE_SIZE * 2);
	mapGroup.children[2].setAttribute("y", currentGameConfig.h * TILE_SIZE);
	mapGroup.children[3].setAttribute("y", -TILE_SIZE * 2);
	mapGroup.children[0].setAttribute("width", TILE_SIZE * 2);
	mapGroup.children[1].setAttribute("width", (currentGameConfig.w + 100) * TILE_SIZE);
	mapGroup.children[2].setAttribute("width", (currentGameConfig.w + 100) * TILE_SIZE);
	mapGroup.children[3].setAttribute("width", TILE_SIZE * 100);
	mapGroup.children[0].setAttribute("height", (currentGameConfig.h + 100) * TILE_SIZE);
	mapGroup.children[1].setAttribute("height", TILE_SIZE * 2);
	mapGroup.children[2].setAttribute("height", TILE_SIZE * 100);
	mapGroup.children[3].setAttribute("height", (currentGameConfig.h + 100) * TILE_SIZE);
}

//Mouse scroll variables
var scrollInterval = -1;
var scrollDirection = -1; //counter-clockwise with 0 being due east, so 7,0,1 scroll right, 1,2,3 scroll up, 3,4,5 scroll left, and 5,6,7 scroll down
var scrolledTimes = 0;
var middleClickLocation;
const scrollBorderPixels = 10;
gameView.addEventListener("mousemove", function (event) {
	var bufferZone = scrollBorderPixels * (scrollInterval == -1 ? 1 : 5); //Use the constant, but give extra border space when already scrolling so the user has to move the cursor farther away to stop scrolling that they have to move the cursor to start
	scrollDirection = -1;
	//Check corner conditions first so each check is one line and only 1-2 conditions
	if (middleClickLocation) { //We have a reference point
		if (Math.pow(event.clientY - middleClickLocation.y, 2) + Math.pow(event.clientX - middleClickLocation.x, 2) > Math.pow(bufferZone, 2)) { //No scrolling if the cursor is close to where the middle-click occurred
            scrollDirection = Math.atan2(event.clientY - middleClickLocation.y, middleClickLocation.x - event.clientX); //Get a value from -PI to +PI
			scrollDirection = Math.round((Math.PI + scrollDirection) / Math.PI * 4) & 7; //Get the nearest appropriate direction with 8 being changed to 0
		}
	} else {
		if (event.clientX > gameView.clientWidth - bufferZone && event.clientY < bufferZone) scrollDirection = 1;
		else if (event.clientX < bufferZone && event.clientY < bufferZone) scrollDirection = 3;
		else if (event.clientX < bufferZone && event.clientY > gameView.clientHeight - bufferZone) scrollDirection = 5;
		else if (event.clientX > gameView.clientWidth - bufferZone && event.clientY > gameView.clientHeight - bufferZone) scrollDirection = 7;
		else if (event.clientY < bufferZone) scrollDirection = 2;
		else if (event.clientX < bufferZone) scrollDirection = 4;
		else if (event.clientY > gameView.clientHeight - bufferZone) scrollDirection = 6;
		else if (event.clientX > gameView.clientWidth - bufferZone) scrollDirection = 0;
	}

    if (scrollDirection != -1 && scrollInterval == -1) {
        scrollInterval = setInterval(mouseScroll, 300);
	} else if (scrollDirection == -1 && !middleClickLocation) {
		stopScroll();
    }
});
gameView.addEventListener("mouseleave", function() {
	if (!middleClickLocation) stopScroll(); //Let middle-click-and-drag keep scrolling even if the mouse is out of bounds
});

function stopScroll() {
    if (scrollInterval != -1) {
        clearInterval(scrollInterval);
        scrollInterval = -1;
        scrolledTimes = 0;
        middleClickLocation = null;
	}
}
function mouseScroll() {
    if (++scrolledTimes == 2) { //Accelerate
        clearInterval(scrollInterval);
        scrollInterval = setInterval(mouseScroll, 200);
    } else if (scrolledTimes == 6) {
        clearInterval(scrollInterval);
        scrollInterval = setInterval(mouseScroll, 100);
    }
    scroll(scrollDirection);
}
document.addEventListener("keydown", function(event) {
	if (event.key == "ArrowLeft" || event.key.toLowerCase() == 'a') scroll(4);
	else if (event.key == "ArrowRight" || event.key.toLowerCase() == 'd') scroll(0);
	else if (event.key == "ArrowUp" || event.key.toLowerCase() == 'w') scroll(2);
	else if (event.key == "ArrowDown" || event.key.toLowerCase() == 's') scroll(6);
});

document.body.onresize = function () {
	if (screenIsTiny()) displayScale = 2; else displayScale = 1;
	gameView.setAttribute("viewBox", scrollX + " " + scrollY + " " + (document.body.clientWidth / displayScale) + " " + (window.innerHeight / displayScale));
	if (screenIsTiny()) gameView.style.height = window.innerHeight + "px";
	if (gameStates[viewingGameStateIdx]) {
		updateHUD();
        updateMenu();
	}
}
document.body.onresize();

document.body.onmousewheel = (event) => {
	if (shownMenu && shownMenu.scrollList) {
		if (event.clientX < 232) {
			shownMenu.listScroll = Math.min(Math.max(0, shownMenu.listScroll + event.deltaY), shownMenu.listScrollMax); //Scroll and clamp the scroll value to the range [0, listScrollMax]
			shownMenu.scrollList.setAttribute("transform", `translate(0,${-shownMenu.listScroll})`);
		} else {
			shownMenu.descriptionScroll = Math.min(Math.max(0, shownMenu.descriptionScroll + event.deltaY), shownMenu.descriptionScrollMax);
			[...shownMenu.descriptionArea.querySelectorAll("span")].forEach(p => p.style.top = -shownMenu.descriptionScroll + "px")
		}
	} else if (shownMenu && shownMenu.textScrollMax) {
        shownMenu.textScroll = Math.min(Math.max(0, shownMenu.textScroll + event.deltaY), shownMenu.textScrollMax);
        [...shownMenu.elem.querySelectorAll("span")].forEach(p => p.style.top = -shownMenu.textScroll + "px")
    }
};

var touchStartScrolls;
var touchStarts = [];
var exitedDeadZone = false;
var menuZone = false;
document.addEventListener("touchstart", (event) => {
	if (event.touches[0].clientY < 50) menuZone = true; //If you start dragging very close to the top of the screen, may as well let the browser's default behavior take over. (This was more important when the height was 100vh.)
	else event.preventDefault();
	touchStarts = [...event.touches].map(p => { return { x: p.clientX, y: p.clientY, identifier: p.identifier } });
	if (event.touches.length == 1) touchStartScrolls = { x: scrollX, y: scrollY, textScroll: (shownMenu || {}).textScroll, descriptionScroll: (shownMenu || {}).descriptionScroll, listScroll: (shownMenu || {}).listScroll };
}, { passive: false });

document.addEventListener("touchmove", (event) => {
	if (menuZone) return; else event.preventDefault();
	if (event.touches.length == 1) { //Note: this is too simple to work well if they touch with two fingers then release the one they touched with first
		var initialTouch = touchStarts.find(p => p.identifier == event.touches[0].identifier);
		if (!initialTouch || touchStarts.length > 1) return; //Don't scroll if the user was touching 2 at some point since they last released all the touch points. (With the current logic, touchStarts.length can't be 1 unless they release all points and then touch again.)
		var xDiff = (initialTouch.x - event.touches[0].clientX) / displayScale;
		var yDiff = (initialTouch.y - event.touches[0].clientY) / displayScale;

		//Dead zone
		if (Math.abs(xDiff) > 15 || Math.abs(yDiff) > 15) exitedDeadZone = true;
		if (!exitedDeadZone) return;

		if (shownMenu && shownMenu.scrollList) {
			if (event.touches[0].clientX / displayScale < 232) {
				shownMenu.listScroll = Math.min(Math.max(0, touchStartScrolls.listScroll + yDiff), shownMenu.listScrollMax); //Scroll and clamp the scroll value to the range [0, listScrollMax]
				shownMenu.scrollList.setAttribute("transform", `translate(0,${-shownMenu.listScroll})`);
			} else {
				shownMenu.descriptionScroll = Math.min(Math.max(0, touchStartScrolls.descriptionScroll + yDiff), shownMenu.descriptionScrollMax);
				[...shownMenu.descriptionArea.querySelectorAll("span")].forEach(p => p.style.top = -shownMenu.descriptionScroll + "px");
			}
		} else if (shownMenu && shownMenu.textScrollMax) {
			shownMenu.textScroll = Math.min(Math.max(0, touchStartScrolls.textScroll + yDiff), shownMenu.textScrollMax);
			[...shownMenu.elem.querySelectorAll("span")].forEach(p => p.style.top = -shownMenu.textScroll + "px");
		} else {
			var newScrollX = Math.round((touchStartScrolls.x + xDiff) / TILE_SIZE) * TILE_SIZE;
			var newScrollY = Math.round((touchStartScrolls.y + yDiff) / TILE_SIZE) * TILE_SIZE;
			newScrollX = Math.max(Math.min(newScrollX, TILE_SIZE * currentGameConfig.w), -TILE_SIZE * 2);
			newScrollY = Math.max(Math.min(newScrollY, TILE_SIZE * currentGameConfig.h), -TILE_SIZE * 2);
			if (newScrollX != scrollX || newScrollY != scrollY) {
				scrollX = newScrollX;
				scrollY = newScrollY;
				document.body.onresize();
			}
		}
	} else if (event.touches.length == 2) { //zoom
		//TODO (or maybe don't! Not sure if I should handle zoom myself)
	}
}, { passive: false });

document.addEventListener("touchend", (event) => {
	if (!exitedDeadZone && touchStarts.length == 1) { //Touch started and ended within a small area, so simulate a left-click on the element at that location
		var e = new MouseEvent("mousedown", { clientX: touchStarts[0].x, clientY: touchStarts[0].y, bubbles: true });
		var target = document.elementFromPoint(touchStarts[0].x, touchStarts[0].y) || document;
		target.dispatchEvent(e);
    }
	exitedDeadZone = false;
	menuZone = false;
});

document.addEventListener("touchcancel", (event) => {
	//No action needed at the moment, but this should generally match touchend.
});

function roundToMapCoords(cursorEvent) {
	//We may scroll by directly changing x and y of the viewBox itself, but maybe we'll want to move the mapGroup instead so we don't have to adjust hudGroup
	return { x: Math.floor((cursorEvent.clientX / displayScale + scrollX) / TILE_SIZE) * TILE_SIZE, y: Math.floor((cursorEvent.clientY / displayScale + scrollY) / TILE_SIZE) * TILE_SIZE };
}

class MapCoordMenu {
	constructor(type, x, y) {
		this.type = type;
		this.x = x;
		this.y = y;
		
		var xPos = x * TILE_SIZE;
		var yPos = y * TILE_SIZE;
		this.elem = document.createElementNS("http://www.w3.org/2000/svg", "g");
		this.elem.setAttribute("transform", `translate(${xPos},${yPos})`);
		this.elem.onmousedown = this.close; //Actually should be on pretty much everything BUT the menu, but this applies to the construction area highlight as well
	}
	
	close(event) {
		shownMenu.elem.remove();
		shownMenu = null;
		if (event) {
			event.stopPropagation();
			event.preventDefault();
		}
		return false;
	}
}

//Handles the mouse-down event on both the gameView as a whole (if not prevented by a more specific mouse event) and on units
function mouseDownHandler(event, menuType) {
	if (event.button == 0 || event.button == 2) { //Pop open a menu for left- or right-click
		var pos = roundToMapCoords(event);
		if (shownMenu && shownMenu.elem) return shownMenu.close(event);

		//Clicking along the right and probably bottom edges of sprites can result in the wrong one getting clicked or the sprite getting the click event but the position being interpreted as an empty tile, so do a quick check to prevent that case
		if (menuType == "alterUnit" && !gameStates[viewingGameStateIdx].units.find(p => p.x == pos.x / TILE_SIZE && p.y == pos.y / TILE_SIZE)) menuType = "buildCategories";

        if (pos.x >= 0 && pos.y >= 0 && pos.x < currentGameConfig.w * TILE_SIZE && pos.y < currentGameConfig.h * TILE_SIZE) shownMenu = new MapCoordMenu(menuType, pos.x / TILE_SIZE, pos.y / TILE_SIZE); //Only open a menu if the clicked tile is within the map bounds
		updateDisplay();
	} else if (event.button == 1) { //Scroll for middle-click-and-drag
		middleClickLocation = {x: event.clientX, y: event.clientY};
	} else return; //Let special mouse buttons do their thing, I guess
	event.stopPropagation();
	event.preventDefault(); //stop from selecting text and stuff
}


gameView.addEventListener("mousedown", (event) => mouseDownHandler(event, "buildCategories"));
window.addEventListener("mouseup", (event) => { if (event.button == 1) stopScroll(); }); //So we can catch the middle button being released even if it's outside the browser window

var currentGameConfig;
function switchToGame(config, states, playerIdx) {
	//Clear the graphics from the previously-loaded game
	if (gameStates && gameStates.length) {
		for (var x = 0; x < gameStates[viewingGameStateIdx].units.length; x++) {
			gameStates[viewingGameStateIdx].units[x].sprite.remove();
		}
	}

	currentGameConfig = config;
	gameStates = states;
	setResetBorders();

	if (playerIdx !== undefined) viewAsPlayerIdx = playerIdx;

	//Set the viewing game state to the next state that this player hasn't performed a turn-completing action in
	viewingGameStateIdx = gameStates.length - gameStates.slice().reverse().findIndex(p => p.actions.some(q => q.playerIdx == viewAsPlayerIdx && turnEndingActions.includes(q.action)));
	if (viewingGameStateIdx == gameStates.length) {
		viewingGameStateIdx = gameStates.length - 1;
		gameStates.push(new GameState(gameStates[viewingGameStateIdx])); //Add a fresh game state because we already played the last one
		clientAdvanceTurn(true); //Run the calculations for the new state
	}
	else if (viewingGameStateIdx > gameStates.length) { //None of the game states have an action performed by this player. Assume they were inactive and send them back to the first state (see the next if statement--we may advance them one state from there).
		viewingGameStateIdx = 0;
    }
	if (viewingGameStateIdx == 0 && gameStates[0].turn > 0) clientAdvanceTurn(true); //Game state index 0 is unacceptable unless it's turn 0, as it doesn't have runResources executed and such.

	if (gameStates[viewingGameStateIdx].turn == 0) {
		shownMenu = new MapCoordMenu("simpleNotice", 0, 0);
		shownMenu.text = "Our joint military forces are on a mission to colonize a planet we named Burgustar. Another intelligent species made their home here recently, and their humanlike but irrational fear of the unknown has led them to adopt a hostile stance with us.\n\nOur immediate need is to amass and maintain a clearly more powerful military force than the alien colony to curb any preemptive attack they may want to mount, but our final goal is a peaceful coexistence. We cannot have our first contact with an intelligent alien species start with bloodshed.";
		shownMenu.textJP = "私達の合同軍隊は、バーガスターと名付けた惑星を植民地化する使命を帯びている。別の知的な種族が最近ここに移転したが、未知への不合理な、そして人間のような恐怖のお陰で、私達と敵対的なスタンスをとっている。\n\n私達の当面の必要性は、宇宙人の植民地よりも明らかに強力な軍事力を蓄積して維持し、彼らが開始したい先制攻撃を抑制することだ。でも、最終的な目標は平和共存だ。知的生命体との最初の接触を流血から始めることは許されない。";
	} else if (shownMenu) shownMenu.close();

	//for (var x = 0; x < gameStates[viewingGameStateIdx].players.length; x++) gameStates[viewingGameStateIdx].players[x].buildabilityMatrix = getBuildableLocationsForPlayer(currentGameConfig, gameStates[viewingGameStateIdx], x); //Not necessary because it lazy-calculates when needed
	updateDisplay();
}

function clientAdvanceTurn(doNotUpload) { //Should be called after any call to GameState.update() if the delta's action is in the turnEndingActions list
	baselineGameStateIdx = gameStates.length - 1 - gameStates.slice().reverse().findIndex(p => p.players.filter(q => q.active).length == p.actions.filter(q => turnEndingActions.includes(q.action)).length); //Find the most recent (highest index) game state in which all active players have performed their final action
	viewingGameStateIdx++;
	if (!gameStates[viewingGameStateIdx]) gameStates.push(new GameState(gameStates[viewingGameStateIdx - 1]));
	else {
		//We need *everyone's* actions to still be reflected in the next turn--as long as they're valid actions--so we both have to re-clone the game state from the previous *and* have to re-update it using the actions it had before we overwrite it
		var keepActions = gameStates[viewingGameStateIdx].actions;
		gameStates[viewingGameStateIdx] = new GameState(gameStates[viewingGameStateIdx - 1]);
		keepActions.filter(action => !gameStates[viewingGameStateIdx].getReasonIfInvalid(currentGameConfig, action)).forEach(action => gameStates[viewingGameStateIdx].update(currentGameConfig, action));
		//Should really do the same for every following game state, but we don't have to do it all at once. (But if we switch back to another player via switchPlayer() it'll look wrong if we didn't catch up fully when playing as the other player.)
	}
	advanceTurn(currentGameConfig, gameStates[viewingGameStateIdx - 1], gameStates[viewingGameStateIdx]);
	//TODO: need to hide units demolished by other players
	updateDisplay(true);

	//Submit this player's deltas in gameStates[viewingGameStateIdx - 1] to the server via POST to /game
	if (currentGameConfig.id && !doNotUpload) {
		//TODO: Show uploading indicator
		var deltas = gameStates[viewingGameStateIdx - 1].actions.filter(p => p.playerIdx == viewAsPlayerIdx);
		fetch(serverUrl + "game?id=" + currentGameConfig.id, { method: 'POST', body: JSON.stringify(deltas) })
			.then(res => res.json())
			.then(res => {
				if (res.redirectTo) { //Redirect the top-level page rather than the JSON request like an HTTP 307 response would've done
					window.location.href = res.redirectTo;
					return;
				}

				//TODO: hide uploading indicator. Tell player if something went wrong.
				if (!res.ok) alert("The save failed because the action is invalid according to the server: " + res.text); //TODON'T - I'd like a prettier message and to undo the action (if server comms failed, it should also give a message, but unobstructive, and it should queue all the deltas to send at once when the connection stops failing)
			})
			.catch(err => console.error(err));
	}
}

function switchPlayer(playerIdx) { //Might only be used for testing. Why would you have multiple players on one account otherwise? :P But could also be used for replays or something.
	//Remove all sprites because updateDisplay() never removes any
	gameStates[viewingGameStateIdx].units.forEach(p => { if (p.sprite) { p.sprite.remove(); p.sprite = undefined; } });
	viewAsPlayerIdx = playerIdx;
	viewingGameStateIdx = gameStates.findIndex(p => !p.actions.some(q => q.playerIdx == viewAsPlayerIdx && turnEndingActions.includes(q.action))); //Find the first loaded state that lacks any turn-ending actions performed by this player
	if (viewingGameStateIdx == -1) {
		viewingGameStateIdx = gameStates.length; //Make a new turn if there isn't a new enough one (not sure how this happens, but it does for player index 1, but I never had it happen for player index 0, buuut the players should be in-sync)
		gameStates.push(new GameState(gameStates[viewingGameStateIdx - 1]));
	}
	//But index 0 is also unacceptable unless it's turn 0, as it doesn't have runResources executed and such.
	if (viewingGameStateIdx == 0 && gameStates[0].turn > 0) clientAdvanceTurn(true); else updateDisplay(true);
}

if (window.location.search.length < 5) {
	//Set up a test GameState
	(function () {
		var config = { id: 0 /*ID should be sent with every server request*/, w: 64 /*map size, in tiles*/, h: 64, deactivatePlayersAfterHours: 24 /*max time since a player's last move before they're automatically booted from the game so as to not hold up other players' progress*/, difficulty: 0, maxAdvancePlays: 5, version: 0 /*game version/unit availability so updates don't break in-progress games*/ };
		var state = new GameState();
		state.players.push(new PlayerState());
		state.players[0].resources = [20, 0, 0, 0, 0, 0, 2, 0, 0, 5, 6, 2, 0, 0];
		generateInitialMap(config, state);

		switchToGame(config, [state]);
	})();
} else {
	var searchParams = window.location.search.substring(1).split("=");
	if (searchParams[0].toLowerCase() == "id") {
		//Connect to server and load a game state from there (hard-coded for testing)
		fetch(serverUrl + "game?id=" + parseInt(searchParams[1]), { method: 'GET' })
			.then(res => res.json())
			.then(res => {
				if (res.redirectTo) { //Redirect the top-level page rather than the JSON request like an HTTP 307 response would've done
					window.location.href = res.redirectTo;
					return;
                }

				res.gameStates = res.gameStates.map(p => Object.assign(new GameState(), p)); //Create new GameState objects to apply them to so they have the appropriate methods and all
				res.gameStates.forEach(state => state.players = state.players.map(p => Object.assign(new PlayerState(), p))); //Do the same kind of thing for the player states
				var playerIdx = res.gameStates.map(q => q.players.findIndex(p => p.playerID == res.playerID)).find(p => p != -1);
				switchToGame(res.config, res.gameStates, playerIdx);
			})
			.catch(err => console.error(err));
    }
}

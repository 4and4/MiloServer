
'use strict';
var Helpers = require('./helpers');
var clearOutput = require('./functions.js').clearOutput;
var MSG = require('./strings');
var Datasets = require('./datasets');
var BlocklyStorage = window.BlocklyStorage = require('./storage');
var statistics_pmf = require('./statistics/pmf');
var statistics_cdf = require('./statistics/cdf');
var DeepLearn = require('./deeplearn');
var swal = require('sweetalert');
// Export globally
window.$ = require('jquery');
window.jQuery  = window.$;
window.Datasets = Datasets;
var Blockly = window.Blockly = require('milo-blocks');
window.DeepLearn = DeepLearn;

var utils = require('./functions')
for (var key in utils) {
  global[key] = utils[key];
}
for(var key in statistics_pmf)
	global[key]=statistics_pmf[key];
for(var key in statistics_cdf)
	global[key]=statistics_cdf[key];

/**
 * Create a namespace for the application.
 */
var Milo = {};

/**
 * Lookup for names of supported languages.  Keys should be in ISO 639 format.
 */
Milo.LANGUAGE_NAME = {
	'en': 'English'
};

/**
 * List of RTL languages.
 */
Milo.LANGUAGE_RTL = [];

/**
 * Blockly's main workspace.
 * @type {Blockly.WorkspaceSvg}
 */
Milo.workspace = null;

/**
 * Extracts a parameter from the URL.
 * If the parameter is absent default_value is returned.
 * @param {string} name The name of the parameter.
 * @param {string} defaultValue Value to return if paramater not found.
 * @return {string} The parameter value or the default value if not found.
 */
Milo.getStringParamFromUrl = function(name, defaultValue) {
	var val = location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
	return val ? decodeURIComponent(val[1].replace(/\+/g, '%20')) : defaultValue;
};

/**
 * Get the language of this user from the URL.
 * @return {string} User's language.
 */
Milo.getLang = function() {
	var lang = Milo.getStringParamFromUrl('lang', '');
	if (Milo.LANGUAGE_NAME[lang] === undefined) {
		// Default to English.
		lang = 'en';
	}
	return lang;
};

/**
 * Is the current language (Milo.LANG) an RTL language?
 * @return {boolean} True if RTL, false if LTR.
 */
Milo.isRtl = function() {
	return Milo.LANGUAGE_RTL.indexOf(Milo.LANG) != -1;
};

/**
 * Load blocks saved on App Engine Storage or in session/local storage.
 * @param {string} defaultXml Text representation of default blocks.
 */
Milo.loadBlocks = function(defaultXml) {
	try {
		var loadOnce = window.sessionStorage.loadOnceBlocks;
	} catch(e) {
		// Firefox sometimes throws a SecurityError when accessing sessionStorage.
		// Restarting Firefox fixes this, so it looks like a bug.
		var loadOnce = null;
	}
	if ('BlocklyStorage' in window && window.location.hash.length > 1) {
		// An href with #key trigers an AJAX call to retrieve saved blocks.
		BlocklyStorage.retrieveXml(window.location.hash.substring(1));
	} else if (loadOnce) {
		// Language switching stores the blocks during the reload.
		delete window.sessionStorage.loadOnceBlocks;
		var xml = Blockly.Xml.textToDom(loadOnce);
		Blockly.Xml.domToWorkspace(xml, Milo.workspace);
	} else if (defaultXml) {
		// Load the editor with default starting blocks.
		var xml = Blockly.Xml.textToDom(defaultXml);
		Blockly.Xml.domToWorkspace(xml, Milo.workspace);
	} else if ('BlocklyStorage' in window) {
		// Restore saved blocks in a separate thread so that subsequent
		// initialization is not affected from a failed load.
		window.setTimeout(BlocklyStorage.restoreBlocks, 0);
	}
};

/**
 * Save the blocks and reload with a different language.
 */
Milo.changeLanguage = function() {
	// Store the blocks for the duration of the reload.
	// This should be skipped for the index page, which has no blocks and does
	// not load Blockly.
	// MSIE 11 does not support sessionStorage on file:// URLs.
	if (typeof Blockly != 'undefined' && window.sessionStorage) {
		var xml = Blockly.Xml.workspaceToDom(Milo.workspace);
		var text = Blockly.Xml.domToText(xml);
		window.sessionStorage.loadOnceBlocks = text;
	}

	var languageMenu = document.getElementById('languageMenu');
	var newLang = encodeURIComponent(
			languageMenu.options[languageMenu.selectedIndex].value);
	var search = window.location.search;
	if (search.length <= 1) {
		search = '?lang=' + newLang;
	} else if (search.match(/[?&]lang=[^&]*/)) {
		search = search.replace(/([?&]lang=)[^&]*/, '$1' + newLang);
	} else {
		search = search.replace(/\?/, '?lang=' + newLang + '&');
	}

	window.location = window.location.protocol + '//' +
			window.location.host + window.location.pathname + search;
};


/**
 * Bind a function to a button's click event.
 * On touch enabled browsers, ontouchend is treated as equivalent to onclick.
 * @param {!Element|string} el Button element or ID thereof.
 * @param {!Function} func Event handler to bind.
 */
Milo.bindClick = function(el, func) {
	if (typeof el == 'string') {
		el = document.getElementById(el);
	}
	el.addEventListener('click', func, true);
	el.addEventListener('touchend', func, true);
};

/**
 * Load the Prettify CSS and JavaScript.
 */
Milo.importPrettify = function() {
	var script = document.createElement('script');
	script.setAttribute('src', 'js/run_prettify.js');
	document.head.appendChild(script);
};

/**
 * Compute the absolute coordinates and dimensions of an HTML element.
 * @param {!Element} element Element to match.
 * @return {!Object} Contains height, width, x, and y properties.
 * @private
 */
Milo.getBBox_ = function(element) {
	var height = element.offsetHeight;
	var width = element.offsetWidth;
	var x = 0;
	var y = 0;
	do {
		x += element.offsetLeft;
		y += element.offsetTop;
		element = element.offsetParent;
	} while (element);
	return {
		height: height,
		width: width,
		x: x,
		y: y
	};
};

/**
 * User's language (e.g. "en").
 * @type {string}
 */
Milo.LANG = Milo.getLang();

/**
 * List of tab names.
 * @private
 */
Milo.TABS_ = ['blocks', 'javascript', 'data', 'xml'];

Milo.selected = 'blocks';

/**
 * Switch the visible pane when a tab is clicked.
 * @param {string} clickedName Name of tab clicked.
 */
Milo.tabClick = function(clickedName) {
	// If the XML tab was open, save and render the content.
	if (document.getElementById('tab_xml').className == 'tabon') {
		var xmlTextarea = document.getElementById('content_xml');
		var xmlText = xmlTextarea.value;
		var xmlDom = null;
		try {
			xmlDom = Blockly.Xml.textToDom(xmlText);
		} catch (e) {
			var q =
					window.confirm(MSG['badXml'].replace('%1', e));
			if (!q) {
				// Leave the user on the XML tab.
				return;
			}
		}
		if (xmlDom) {
			Milo.workspace.clear();
			Blockly.Xml.domToWorkspace(xmlDom, Milo.workspace);
		}
	}

	if (document.getElementById('tab_blocks').className == 'tabon') {
		Milo.workspace.setVisible(false);
	}
	// Deselect all tabs and hide all panes.
	for (var i = 0; i < Milo.TABS_.length; i++) {
		var name = Milo.TABS_[i];
		document.getElementById('tab_' + name).className = 'taboff';
		$('#tab_' + name).parent().removeClass('active');
		document.getElementById('content_' + name).style.visibility = 'hidden';
	}

	// Select the active tab.
	Milo.selected = clickedName;
	document.getElementById('tab_' + clickedName).className = 'tabon';
	$('#tab_' + clickedName).parent().addClass('active');
	// Show the selected pane.
	document.getElementById('content_' + clickedName).style.visibility =
			'visible';
	Milo.renderContent();
	if (clickedName == 'blocks') {
		Milo.workspace.setVisible(true);
	}
	Blockly.svgResize(Milo.workspace);
};

/**
 * Populate the currently selected pane with content generated from the blocks.
 */
Milo.renderContent = function() {
	var content = document.getElementById('content_' + Milo.selected);

	// Initialize the pane.
	if (content.id == 'content_xml') {
		var xmlTextarea = document.getElementById('content_xml_text');
		var xmlDom = Blockly.Xml.workspaceToDom(Milo.workspace);
		var xmlText = Blockly.Xml.domToPrettyText(xmlDom);
		xmlTextarea.value = xmlText;
		xmlTextarea.focus();
	} else if (content.id == 'content_javascript') {
		$("#graph_output").show();
		var code = Blockly.JavaScript.workspaceToCode(Milo.workspace);
		var sourceElement = document.getElementById("source_javascript");
		sourceElement.textContent = code;
		if (typeof PR.prettyPrintOne == 'function') {
			code = sourceElement.textContent;
			code = PR.prettyPrintOne(code, 'js');
			sourceElement.innerHTML = code;
		}
	} else if (content.id == 'content_data') {
			//$('#table').jexcel({ data:Dataset.exceldata, colHeaders: ["1","2"], colWidths: [ 300, 80, 100 ] });
			var defaultDatasets = Object.keys(Datasets.loaded);
			$("#builtInDropdown").empty();
			for (var index in defaultDatasets){
				$("#builtInDropdown").append('<option value="'+defaultDatasets[index]+'">'+ defaultDatasets[index]+' Dataset </option>');
			}
	}
};

/**
 * Initialize Blockly.  Called on page load.
 */
Milo.init = function() {
	Milo.initLanguage();

	// var onresize = function(e) {
	// 	var bBox = Milo.getBBox_(container);
	// 	var el = document.getElementById('content_workspace');
	// 	el.style.top = bBox.y + 'px';
	// 	el.style.left = bBox.x + 'px';
	// 	// Height and width need to be set, read back, then set again to
	// 	// compensate for scrollbars.
	// 	el.style.height = bBox.height + 'px';
	// 	el.style.height = (2 * bBox.height - el.offsetHeight) + 'px';
	// 	el.style.width = bBox.width + 'px';
	// 	el.style.width = (2 * bBox.width - el.offsetWidth) + 'px';

	// 	// Make the 'Blocks' tab line up with the toolbox.
	// 	// if (Milo.workspace && Milo.workspace.toolbox_.width) {
	// 	// 	document.getElementById('tab_blocks').style.minWidth =
	// 	// 			(Milo.workspace.toolbox_.width - 38) + 'px';
	// 				// Account for the 19 pixel margin and on each side.
	// };
	//window.addEventListener('resize', onresize, false);

	// The toolbox XML specifies each category name using Blockly's messaging
	// format (eg. `<category name="%{BKY_CATLOGIC}">`).
	// These message keys need to be defined in `Blockly.Msg` in order to
	// be decoded by the library. Therefore, we'll use the `MSG` dictionary that's
	// been defined for each language to import each category name message
	// into `Blockly.Msg`.
	// TODO: Clean up the message files so this is done explicitly instead of
	// through this for-loop.
	for (var messageKey in MSG) {
		if (messageKey.indexOf('cat') == 0) {
			Blockly.Msg[messageKey.toUpperCase()] = MSG[messageKey];
		}
	}

	// Construct the toolbox XML, replacing translated variable names.
	var toolboxText = document.getElementById('toolbox').outerHTML;
	toolboxText = toolboxText.replace(/(^|[^%]){(\w+)}/g,
			function(m, p1, p2) {return p1 + MSG[p2];});
	var toolboxXml = Blockly.Xml.textToDom(toolboxText);

	Milo.workspace = Blockly.inject('content_workspace', {
		media: 'media/',
		toolbox: toolboxXml,
		zoom: {
			controls: true,
			wheel: false
		}
	});
	//var workspaceDiv = document.getElementById('content_workspace');
	//var container = document.getElementById('content_area');
	// var onresize = function(e) {
	// 	// Compute the absolute coordinates and dimensions of blocklyArea.
	// 	var element = container;
	// 	var x = 0;
	// 	var y = 0;
	// 	do {
	// 		x += element.offsetLeft;
	// 		y += element.offsetTop;
	// 		element = element.offsetParent;
	// 	} while (element);
	// 	// Position blocklyDiv over blocklyArea.
	// 	workspaceDiv.style.left = x + 'px';
	// 	workspaceDiv.style.top = y + 'px';
	// 	workspaceDiv.style.width = container.offsetWidth + 'px';
	// 	workspaceDiv.style.height = container.offsetHeight + 'px';
	// };
	// window.addEventListener('resize', onresize, false);
	// onresize();
	// Blockly.svgResize(Milo.workspace);
	// Add to reserved word list: Local variables in execution environment (runJS)
	// and the infinite loop detection function.
	Blockly.JavaScript.addReservedWords(
		'code,jscode,setup,dl,graph,math,session,DeepLearn,Data,WebCam,SqueezeNet,timeouts,checkTimeout'
	);
	// Register callbacks for buttons
	// TODO(arjun): implement adddataset callback
	Milo.workspace.registerToolboxCategoryCallback('DATASETS',Datasets.flyoutCallback);
	// Per https://groups.google.com/d/msg/blockly/Ux9OQuyJ9XE/8PvZt73aBgAJ need to update due to bug.
	Milo.workspace.updateToolbox(document.getElementById('toolbox'));

	Milo.loadBlocks('');

	if ('BlocklyStorage' in window) {
		// Hook a save function onto unload.
		BlocklyStorage.backupOnUnload(Milo.workspace);
	}

	Milo.tabClick(Milo.selected);

	Milo.bindClick('trashButton',function() {
				Milo.discard();
				Milo.renderContent();
	});
	Milo.bindClick('runButton', Milo.runJS);
	// TODO(arjun): Enable link button once Node JS server is setup with DB Store
	var linkButton = document.getElementById('linkButton');
	if ('BlocklyStorage' in window) {
		BlocklyStorage['HTTPREQUEST_ERROR'] = MSG['httpRequestError'];
		BlocklyStorage['LINK_ALERT'] = MSG['linkAlert'];
		BlocklyStorage['HASH_ERROR'] = MSG['hashError'];
		BlocklyStorage['XML_ERROR'] = MSG['xmlError'];
		Milo.bindClick(linkButton, function() {
			BlocklyStorage.link(Milo.workspace);
		});
	}

	for (var i = 0; i < Milo.TABS_.length; i++) {
		var name = Milo.TABS_[i];
		Milo.bindClick('tab_' + name,
				function(name_) {return function() {Milo.tabClick(name_);};}(name));
	}
	//onresize();
	//Blockly.svgResize(Milo.workspace);

	// Lazy-load the syntax-highlighting.
	window.setTimeout(Milo.importPrettify, 1);

};

/**
 * Initialize the page language.
 */
Milo.initLanguage = function() {
	// Set the HTML's language and direction.
	var rtl = Milo.isRtl();
	document.dir = rtl ? 'rtl' : 'ltr';
	document.head.parentElement.setAttribute('lang', Milo.LANG);

	// Sort languages alphabetically.
	var languages = [];
	for (var lang in Milo.LANGUAGE_NAME) {
		languages.push([Milo.LANGUAGE_NAME[lang], lang]);
	}
	var comp = function(a, b) {
		// Sort based on first argument ('English', 'Русский', '简体字', etc).
		if (a[0] > b[0]) return 1;
		if (a[0] < b[0]) return -1;
		return 0;
	};
	languages.sort(comp);
	// Populate the language selection menu.
	var languageMenu = document.getElementById('languageMenu');
	languageMenu.options.length = 0;
	for (var i = 0; i < languages.length; i++) {
		var tuple = languages[i];
		var lang = tuple[tuple.length - 1];
		var option = new Option(tuple[0], lang);
		if (lang == Milo.LANG) {
			option.selected = true;
		}
		languageMenu.options.add(option);
	}
	languageMenu.addEventListener('change', Milo.changeLanguage, true);


};

/**
 * Execute the user's Milo.
 * Just a quick and dirty eval.  Catch infinite loops.
 * TODO(arjun): Replace with JS Interpretter from
 *              https://developers.google.com/blockly/guides/app-integration/running-javascript
 */
Milo.runJS = function() {
	// Milo.selected = 'javascript';
	// Milo.tabClick(Milo.selected);
	document.getElementById("graph_output").innerHTML="";

	Blockly.JavaScript.INFINITE_LOOP_TRAP = '  checkTimeout();\n';
	var timeouts = 0;
	var checkTimeout = function() {
		if (timeouts++ > 1000000) {
			throw MSG['timeout'];
		}
	};
	var code = Blockly.JavaScript.workspaceToCode(Milo.workspace);
	Blockly.JavaScript.INFINITE_LOOP_TRAP = null;
	try {
		if(!window.navigator.onLine){
			Helpers.Network.showOfflineAlert();
		}
		var setup =  DeepLearn.setup;
		var jscode = setup + code;
		eval(jscode);
		$("#console_holder").show();

	} catch (e) {
		console.log(jscode);
		Helpers.showAlert("Error",MSG['badCode'].replace('%1', e));
	}
};

/**
 * Discard all blocks from the workspace and clean up any used references like webcam, etc.
 */
Milo.discard = function() {
	var count = Milo.workspace.getAllBlocks().length;
	if (count > 0){
		swal("Are you sure?",Blockly.Msg.DELETE_ALL_BLOCKS.replace('%1', count),"warning",{
			buttons: true,
			dangerMode: true
		}).then(function(val) {
			if (val){
				Milo.workspace.clear();
				if (window.location.hash) {
					window.location.hash = '';
				}
			}
		});
	}
	// Clear run results
	clearOutput();
};

// Load the Code demo's language strings.
// document.write('<script src="msg/' + Milo.LANG + '.js"></script>\n');
// Load Blockly's language strings.
//document.write('<script src="msg/js/' + Milo.LANG + '.js"></script>\n');

window.addEventListener('load', Milo.init);

window.Milo = Milo;
module.exports = Milo;

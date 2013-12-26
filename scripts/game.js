function Game(debugMode) {
	var _currentCode = '';
	var _commands = [];

	this.dimensions = {
		width: 50,
		height: 25
	};

	this.levelFileNames = [
		'01_cellBlockA.jsx',
		'02_theLongWayOut.jsx',
		'03_validationEngaged.jsx',
		'04_multiplicity.jsx',
		'05_minesweeper.jsx',
		'06_drones101.jsx',
		'07_colors.jsx',
		'08_intoTheWoods.jsx',
		'09_fordingTheRiver.jsx',
		'10_ambush.jsx',
		'11_robot.jsx',
		'12_robotNav.jsx',
		'13_robotMaze.jsx',
		//'14_crispsContest.jsx',
		'15_exceptionalCrossing.jsx',
		'16_pointers.jsx',
		'17_superDrEvalBros.jsx',
		//'18_domManipulation.jsx',
		//'19_bossFight.jsx',
		//'20_ULTIMA_BOSS_FIGHT.jsx',
		'99_credits.jsx'
	];

	this.currentLevel = 1;
	this.levelReached = localStorage.getItem('levelReached') || 1;
	this.displayedChapters = [];

	this.getHelpCommands = function () { return _commands; };

	this.initialize = function () {
		// Initialize sound
		this.sound = new Sound();

		// Initialize map display
		this.display = ROT.Display.create(this, {
			width: this.dimensions.width,
			height: this.dimensions.height,
			fontSize: 20
		});
		this.display.setupEventHandlers();
		display = this.display;
		$('#screen').append(this.display.getContainer());
		$('#drawingCanvas').click(function () {
			display.focus();
		});

		// Initialize map and editor
		this.editor = new CodeEditor("editor", 600, 500);
		this.map = new Map(this.display, this);

		// Enable controls
		this.enableShortcutKeys();
		this.enableButtons();

		// Load help commands from local storage (if possible)
		if (localStorage.getItem('helpCommands')) {
			_commands = localStorage.getItem('helpCommands').split(';');
		}

		// Enable debug features
		if (debugMode) {
			this.levelReached = 999; // make all levels accessible
			_commands = Object.keys(this.reference); // display all help
			this.sound.toggleSound(); // mute sound by default in debug mode
		}

		this.intro();
	};

	this.intro = function () {
		this.display.focus();
		this.display.playIntro(this.map);
	};

	this.start = function () {
		this.getLevel(1);
	};

	this.moveToNextLevel = function () {
		var game = this;

		// is the player permitted to exit?
		if (!this.onExit(this.map)) {
			this.sound.playSound('blip');
			return;
		}

		game.currentLevel++;
		game.sound.playSound('complete');

		//we disable moving so the player can't move during the fadeout
		game.map.getPlayer().canMove = false;
		game.getLevel(game.currentLevel);
	};

	this.jumpToNthLevel = function (levelNum) {
		var game = this;
		this.currentLevel = levelNum;
		this.setInventoryStateByLevel(levelNum);
		this.getLevel(levelNum);
		this.display.focus();
	};

	// makes an ajax request to get the level text file and
	// then loads it into the game
	this.getLevel = function (levelNumber) {
		var game = this;

		game.currentLevel = levelNumber;
		game.levelReached = Math.max(levelNumber, game.levelReached);
		if (!debugMode) {
			localStorage.setItem('levelReached', game.levelReached);
		}

		var fileName = game.levelFileNames[levelNumber - 1];
		$.get('levels/' + fileName, function (lvlCode) {
			// load level code in editor
			game.editor.loadCode(lvlCode);

			// start the level and fade in
			game.evalLevelCode(null, null, true);
			game.display.focus();

			// store the commands introduced in this level (for api reference)
			_commands = _commands.concat(game.editor.getProperties().commandsIntroduced).unique();
			localStorage.setItem('helpCommands', _commands.join(';'));
		});
	};

	// restart level with currently loaded code
	this.restartLevel = function () {
		this.editor.setCode(_currentCode);
		this.evalLevelCode();
	};

	this.evalLevelCode = function (allCode, playerCode, isNewLevel) {
		var game = this;

		// by default, get code from the editor
		var loadedFromEditor = false;
		if (!allCode) {
			allCode = this.editor.getCode();
			playerCode = this.editor.getPlayerCode();
			loadedFromEditor = true;
		}

		// save current display state (for scrolling up later)
		this.display.saveGrid(this.map);

		// validate the code
		// if it passes validation, returns the startLevel function if it pass
		// if it fails validation, returns false
		var validatedStartLevel = this.validate(allCode, playerCode);

		if (validatedStartLevel) { // code is valid
			// reset the map
			this.map.reset();
			this.map.setProperties(this.editor.getProperties()['mapProperties']);

			// save editor state
			_currentCode = allCode;
			if (loadedFromEditor) {
				this.editor.saveGoodState();
			}

			// clear drawing canvas and hide it until level loads
			$('#drawingCanvas')[0].width = $('#drawingCanvas')[0].width;
			$('#drawingCanvas').hide();

			// start the level
			validatedStartLevel(this.map);

			// remove inventory items introduced in this level (if any)
			if (this.editor.getProperties().itemsIntroduced) {
				this.editor.getProperties().itemsIntroduced.forEach(function (item) {
					game.removeFromInventory(item);
				});
			}

			// draw the map
			this.display.fadeIn(this.map, isNewLevel ? 100 : 10, function () {
				game.drawInventory(); // refresh inventory display
				$('#drawingCanvas').show(); // show the drawing canvas again
			});

			// start bg music for this level
			if (this.editor.getProperties().music) {
				this.sound.playTrackByName(this.currentLevel, this.editor.getProperties().music);
			} else {
				this.sound.playTrackByNum(this.currentLevel);
			}

			// finally, allow player movement
			this.map.getPlayer().canMove = true;
			game.display.focus();
		} else { // code is invalid
			// play error sound
			this.sound.playSound('static');

			// disable player movement
			this.map.getPlayer().canMove = false;
		}
	};
};

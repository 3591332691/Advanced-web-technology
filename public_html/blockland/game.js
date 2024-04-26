
class Game{
	//构造函数：初始化游戏的各种属性和状态，包括场景、摄像机、玩家对象等。
	constructor(){
		if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

		this.modes = Object.freeze({
			NONE:   Symbol("none"),
			PRELOAD: Symbol("preload"),
			INITIALISING:  Symbol("initialising"),
			CREATING_LEVEL: Symbol("creating_level"),
			ACTIVE: Symbol("active"),
			GAMEOVER: Symbol("gameover")
		});
		this.mode = this.modes.NONE;

		// 在构造函数中创建 Cannon.js 的物理世界实例
		this.world = new CANNON.World();
		this.world.gravity.set(0, -9.82, 0); // 设置重力
		//NaiveBroadphase是默认的碰撞检测方式，该碰撞检测速度比较高
		this.world.broadphase = new CANNON.NaiveBroadphase();
		console.log("物理世界创建完毕");
		this.world.addEventListener('collide', function(event) {
			// 处理碰撞开始事件
			const bodyA = event.bodyA;
			const bodyB = event.bodyB;
			console.log(bodyA,"碰撞了",bodyB);
			// 在这里实现碰撞事件的逻辑处理
		});
		this.container;
		this.player;
		this.cameras;
		this.camera;
		this.scene;
		this.renderer;
		this.animations = {};
		this.assetsPath = 'assets/';
		
		this.remotePlayers = [];
		this.remoteColliders = [];
		this.initialisingPlayers = [];
		this.remoteData = [];
		
		this.messages = { 
			text:[ 
			"Welcome to Blockland",
			"GOOD LUCK!"
			],
			index:0
		}
		
		this.container = document.createElement( 'div' );
		this.container.style.height = '100%';
		document.body.appendChild( this.container );
		
		const sfxExt = SFX.supportsAudioType('mp3') ? 'mp3' : 'ogg';
        
		const game = this;
		this.anims = ['Walking', 'Walking Backwards', 'Turn', 'Running', 'Pointing', 'Talking', 'Pointing Gesture'];
		
		const options = {
			assets:[
				`${this.assetsPath}images/nx.jpg`,
				`${this.assetsPath}images/px.jpg`,
				`${this.assetsPath}images/ny.jpg`,
				`${this.assetsPath}images/py.jpg`,
				`${this.assetsPath}images/nz.jpg`,
				`${this.assetsPath}images/pz.jpg`
			],
			oncomplete: function(){
				game.init();
			}
		}
		
		this.anims.forEach( function(anim){ options.assets.push(`${game.assetsPath}fbx/anims/${anim}.fbx`)});
		options.assets.push(`${game.assetsPath}fbx/town.fbx`);
		
		this.mode = this.modes.PRELOAD;
		
		this.clock = new THREE.Clock();

		const preloader = new Preloader(options);
		
		window.onError = function(error){
			console.error(JSON.stringify(error));
		}
	}
	
	initSfx(){
		this.sfx = {};
		this.sfx.context = new (window.AudioContext || window.webkitAudioContext)();
		this.sfx.gliss = new SFX({
			context: this.sfx.context,
			src:{mp3:`${this.assetsPath}sfx/gliss.mp3`, ogg:`${this.assetsPath}sfx/gliss.ogg`},
			loop: false,
			volume: 0.3
		});
	}
	
	set activeCamera(object){
		this.cameras.active = object;
	}
	//init 方法：初始化游戏的各个部分，包括场景、环境加载、玩家控制器等。
	init() {
		this.updatePhysics();
		this.mode = this.modes.INITIALISING;

		this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 10, 200000 );
		
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( 0x00a0f0 );

		const ambient = new THREE.AmbientLight( 0xaaaaaa );
        this.scene.add( ambient );

        const light = new THREE.DirectionalLight( 0xaaaaaa );
        light.position.set( 30, 100, 40 );
        light.target.position.set( 0, 0, 0 );

        light.castShadow = true;

		const lightSize = 500;
        light.shadow.camera.near = 1;
        light.shadow.camera.far = 500;
		light.shadow.camera.left = light.shadow.camera.bottom = -lightSize;
		light.shadow.camera.right = light.shadow.camera.top = lightSize;

        light.shadow.bias = 0.0039;
        light.shadow.mapSize.width = 1024;
        light.shadow.mapSize.height = 1024;
		
		this.sun = light;
		this.scene.add(light);

		// model
		const loader = new THREE.FBXLoader();
		const game = this;
		
		this.player = new PlayerLocal(this);
		
		this.loadEnvironment(loader);
		this.loadBox(loader);
		this.speechBubble = new SpeechBubble(this, "", 150);
		this.speechBubble.mesh.position.set(0, 350, 0);
		
		this.joystick = new JoyStick({
			onMove: this.playerControl,
			game: this
		});
		
		this.renderer = new THREE.WebGLRenderer( { antialias: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.shadowMap.enabled = true;
		this.container.appendChild( this.renderer.domElement );
		
		if ('ontouchstart' in window){
			window.addEventListener( 'touchdown', (event) => game.onMouseDown(event), false );
		}else{
			window.addEventListener( 'mousedown', (event) => game.onMouseDown(event), false );	
		}
		
		window.addEventListener( 'resize', () => game.onWindowResize(), false );
	}
	//加载箱子
	loadBox(loader) {
		const game = this;
		loader.load(`${game.assetsPath}fbx/MCbox.fbx`, function(object) {
			const textureLoader = new THREE.TextureLoader();
			const texture = textureLoader.load(`${game.assetsPath}images/MCbox.png`, function(texture) {
				// 创建材质
				const material = new THREE.MeshStandardMaterial({
					map: texture,
				});

				// 应用材质到模型的每个面
				object.traverse(function(mesh) {
					if (mesh.isMesh) {
						mesh.material = material;
					}
				});
				// 设置箱子的位置、大小、阴影等属性
				object.position.set(3110, 90, 0);
				object.scale.set(1, 1, 1);
				object.castShadow = true;
				object.receiveShadow = true;

				// 将箱子添加到游戏场景中
				game.scene.add(object);
				// 创建 Cannon.js 刚体
				const boxShape = new CANNON.Box(new CANNON.Vec3(1, 1, 1)); // 设置刚体形状，这里假设箱子是立方体
				const boxBody = new CANNON.Body({ mass: 1 ,id: 'box'}); // 创建刚体并设置质量

				// 将刚体形状与模型尺寸相关联
				const boxSize = object.scale.clone().multiplyScalar(1); // 适当调整尺寸以匹配模型
				boxBody.addShape(boxShape, new CANNON.Vec3(boxSize.x / 2, boxSize.y / 2, boxSize.z / 2)); // 将形状添加到刚体中，并设置位置

				// 将刚体与模型关联起来
				object.userData.physicsBody = boxBody; // 将刚体存储在模型的 userData 中

				// 将刚体添加到物理世界中
				game.world.addBody(boxBody);
				console.log("箱子模型刚体已加载");
				// 启用碰撞检测
				boxBody.addEventListener('collide', function (event) {
					// 处理碰撞事件
					console.log('BOX Collision occurred:', event);
				});
			});
		});
	}
	//loadEnvironment 方法：加载游戏场景中的环境模型，例如城镇。
	loadEnvironment(loader){
		const game = this;
		loader.load(`${this.assetsPath}fbx/town.fbx`, function(object){
			game.environment = object;
			game.colliders = [];
			game.scene.add(object);
			object.traverse( function ( child ) {
				if ( child.isMesh ) {
					if (child.name.startsWith("proxy")){
						game.colliders.push(child);
						child.material.visible = false;
					}else{
						child.castShadow = true;
						child.receiveShadow = true;
					}
				}
			} );
			
			const tloader = new THREE.CubeTextureLoader();
			tloader.setPath( `${game.assetsPath}/images/` );

			var textureCube = tloader.load( [
				'px.jpg', 'nx.jpg',
				'py.jpg', 'ny.jpg',
				'pz.jpg', 'nz.jpg'
			] );

			game.scene.background = textureCube;
			
			game.loadNextAnim(loader);
		})
	}
	//loadNextAnim 方法：加载玩家动画，如行走、奔跑等。
	loadNextAnim(loader){
		let anim = this.anims.pop();
		const game = this;
		loader.load( `${this.assetsPath}fbx/anims/${anim}.fbx`, function( object ){
			game.player.animations[anim] = object.animations[0];
			if (game.anims.length>0){
				game.loadNextAnim(loader);
			}else{
				delete game.anims;
				game.action = "Idle";
				game.mode = game.modes.ACTIVE;
				game.animate();
			}
		});	
	}
	//playerControl 方法：处理玩家的控制输入，根据输入调整玩家的动作。
	playerControl(forward, turn){
		turn = -turn;
		
		if (forward>0.3){
			if (this.player.action!='Walking' && this.player.action!='Running') this.player.action = 'Walking';
		}else if (forward<-0.3){
			if (this.player.action!='Walking Backwards') this.player.action = 'Walking Backwards';
		}else{
			forward = 0;
			if (Math.abs(turn)>0.1){
				if (this.player.action != 'Turn') this.player.action = 'Turn';
			}else if (this.player.action!="Idle"){
				this.player.action = 'Idle';
			}
		}
		
		if (forward==0 && turn==0){
			delete this.player.motion;
		}else{
			this.player.motion = { forward, turn }; 
		}
		
		this.player.updateSocket();
	}
	//createCameras 方法：创建游戏中的各种摄像机视角，如前视、后视、侧视等。
	createCameras(){
		const offset = new THREE.Vector3(0, 80, 0);
		const front = new THREE.Object3D();
		front.position.set(112, 100, 600);
		front.parent = this.player.object;
		const back = new THREE.Object3D();
		back.position.set(0, 300, -1050);
		back.parent = this.player.object;
		const chat = new THREE.Object3D();
		chat.position.set(0, 200, -450);
		chat.parent = this.player.object;
		const wide = new THREE.Object3D();
		wide.position.set(178, 139, 1665);
		wide.parent = this.player.object;
		const overhead = new THREE.Object3D();
		overhead.position.set(0, 400, 0);
		overhead.parent = this.player.object;
		const collect = new THREE.Object3D();
		collect.position.set(40, 82, 94);
		collect.parent = this.player.object;
		this.cameras = { front, back, wide, overhead, collect, chat };
		this.activeCamera = this.cameras.back;	
	}
	showMessage(msg, fontSize=20, onOK=null){
		const txt = document.getElementById('message_text');
		txt.innerHTML = msg;
		txt.style.fontSize = fontSize + 'px';
		const btn = document.getElementById('message_ok');
		const panel = document.getElementById('message');
		const game = this;
		if (onOK!=null){
			btn.onclick = function(){ 
				panel.style.display = 'none';
				onOK.call(game); 
			}
		}else{
			btn.onclick = function(){
				panel.style.display = 'none';
			}
		}
		panel.style.display = 'flex';
	}
	//onWindowResize 方法：处理窗口大小变化事件，调整摄像机的视角。
	onWindowResize() {
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize( window.innerWidth, window.innerHeight );

	}
	//updateRemotePlayers 方法：更新远程玩家的状态，位置等信息。
	updateRemotePlayers(dt){
		if (this.remoteData===undefined || this.remoteData.length == 0 || this.player===undefined || this.player.id===undefined) return;
		
		const newPlayers = [];
		const game = this;
		//Get all remotePlayers from remoteData array
		const remotePlayers = [];
		const remoteColliders = [];
		
		this.remoteData.forEach( function(data){
			if (game.player.id != data.id){
				//Is this player being initialised?
				let iplayer;
				game.initialisingPlayers.forEach( function(player){
					if (player.id == data.id) iplayer = player;
				});
				//If not being initialised check the remotePlayers array
				if (iplayer===undefined){
					let rplayer;
					game.remotePlayers.forEach( function(player){
						if (player.id == data.id) rplayer = player;
					});
					if (rplayer===undefined){
						//Initialise player
						game.initialisingPlayers.push( new Player( game, data ));
					}else{
						//Player exists
						remotePlayers.push(rplayer);
						remoteColliders.push(rplayer.collider);
					}
				}
			}
		});
		
		this.scene.children.forEach( function(object){
			if (object.userData.remotePlayer && game.getRemotePlayerById(object.userData.id)==undefined){
				game.scene.remove(object);
			}	
		});
		
		this.remotePlayers = remotePlayers;
		this.remoteColliders = remoteColliders;
		this.remotePlayers.forEach(function(player){ player.update( dt ); });	
	}
	//onMouseDown 方法：处理鼠标点击事件，根据点击位置执行相应的操作，如选择玩家、聊天等。
	onMouseDown( event ) {
		if (this.remoteColliders===undefined || this.remoteColliders.length==0 || this.speechBubble===undefined || this.speechBubble.mesh===undefined) return;
		
		// calculate mouse position in normalized device coordinates
		// (-1 to +1) for both components
		const mouse = new THREE.Vector2();
		mouse.x = ( event.clientX / this.renderer.domElement.clientWidth ) * 2 - 1;
		mouse.y = - ( event.clientY / this.renderer.domElement.clientHeight ) * 2 + 1;

		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera( mouse, this.camera );
		
		const intersects = raycaster.intersectObjects( this.remoteColliders );
		const chat = document.getElementById('chat');
		
		if (intersects.length>0){
			const object = intersects[0].object;
			const players = this.remotePlayers.filter( function(player){
				if (player.collider!==undefined && player.collider==object){
					return true;
				}
			});
			if (players.length>0){
				const player = players[0];
				console.log(`onMouseDown: player ${player.id}`);
				this.speechBubble.player = player;
				this.speechBubble.update('');
				this.scene.add(this.speechBubble.mesh);
				this.chatSocketId = player.id;
				chat.style.bottom = '0px';
				this.activeCamera = this.cameras.chat;
			}
		}else{
			//Is the chat panel visible?
			if (chat.style.bottom=='0px' && (window.innerHeight - event.clientY)>40){
				console.log("onMouseDown: No player found");
				if (this.speechBubble.mesh.parent!==null) this.speechBubble.mesh.parent.remove(this.speechBubble.mesh);
				delete this.speechBubble.player;
				delete this.chatSocketId;
				chat.style.bottom = '-50px';
				this.activeCamera = this.cameras.back;
			}else{
				console.log("onMouseDown: typing");
			}
		}
	}
	
	getRemotePlayerById(id){
		if (this.remotePlayers===undefined || this.remotePlayers.length==0) return;
		
		const players = this.remotePlayers.filter(function(player){
			if (player.id == id) return true;
		});	
		
		if (players.length==0) return;
		
		return players[0];
	}
	//animate 方法：游戏的主循环，负责更新场景中的动画、玩家状态等，并渲染画面。
	animate() {
		this.updatePhysics();
		const game = this;
		const dt = this.clock.getDelta();
		
		requestAnimationFrame( function(){ game.animate(); } );
		
		this.updateRemotePlayers(dt);
		
		if (this.player.mixer!=undefined && this.mode==this.modes.ACTIVE) this.player.mixer.update(dt);
		
		if (this.player.action=='Walking'){
			const elapsedTime = Date.now() - this.player.actionTime;
			if (elapsedTime>1000 && this.player.motion.forward>0){
				this.player.action = 'Running';
			}
		}
		
		if (this.player.motion !== undefined) this.player.move(dt);
		
		if (this.cameras!=undefined && this.cameras.active!=undefined && this.player!==undefined && this.player.object!==undefined){
			this.camera.position.lerp(this.cameras.active.getWorldPosition(new THREE.Vector3()), 0.05);
			const pos = this.player.object.position.clone();
			if (this.cameras.active==this.cameras.chat){
				pos.y += 200;
			}else{
				pos.y += 300;
			}
			this.camera.lookAt(pos);
		}
		
		if (this.sun !== undefined){
			this.sun.position.copy( this.camera.position );
			this.sun.position.y += 10;
		}
		
		if (this.speechBubble!==undefined) this.speechBubble.show(this.camera.position);
		
		this.renderer.render( this.scene, this.camera );
	}
	// 创建一个更新循环
	updatePhysics() {
		console.log("更新物理世界状态");
		const game = this;
		// 更新物理世界状态
		const fixedTimeStep = 1.0 / 60.0; // 固定的时间步长
		const maxSubSteps = 10; // 最大子步数
		game.world.step(fixedTimeStep, fixedTimeStep, maxSubSteps);

		// 监听碰撞事件
		this.world.addEventListener('beginContact', function(event) {
			// 处理碰撞开始事件
			const bodyA = event.bodyA;
			const bodyB = event.bodyB;
			// 打印碰撞信息
			console.log('碰撞开始：', bodyA, bodyB);
		});
	}
}

class Player{
	constructor(game, options){
		this.local = true;
		let model, colour;
		
		const colours = ['Black', 'Brown', 'White'];
		colour = colours[Math.floor(Math.random()*colours.length)];
									
		if (options===undefined){
			const people = ['BeachBabe', 'BusinessMan', 'Doctor', 'FireFighter', 'Housewife', 'Policeman', 'Prostitute', 'Punk', 'RiotCop', 'Roadworker', 'Robber', 'Sheriff', 'Streetman', 'Waitress'];
			model = people[Math.floor(Math.random()*people.length)];
		}else if (typeof options =='object'){
			this.local = false;
			this.options = options;
			this.id = options.id;
			model = options.model;
			colour = options.colour;
		}else{
			model = options;
		}
		this.model = model;
		this.colour = colour;
		this.game = game;
		this.animations = this.game.animations;
		
		const loader = new THREE.FBXLoader();
		const player = this;
		
		loader.load( `${game.assetsPath}fbx/people/${model}.fbx`, function ( object ) {

			object.mixer = new THREE.AnimationMixer( object );
			player.root = object;
			player.mixer = object.mixer;
			
			object.name = "Person";
					
			object.traverse( function ( child ) {
				if ( child.isMesh ) {
					child.castShadow = true;
					child.receiveShadow = true;		
				}
			} );
			
			
			const textureLoader = new THREE.TextureLoader();
			
			textureLoader.load(`${game.assetsPath}images/SimplePeople_${model}_${colour}.png`, function(texture){
				object.traverse( function ( child ) {
					if ( child.isMesh ){
						child.material.map = texture;
					}
				} );
			});
			
			player.object = new THREE.Object3D();
			player.object.position.set(3122, 0, -173);
			player.object.rotation.set(0, 2.6, 0);
			 // 创建刚体形状
			const boxShape = new CANNON.Box(new CANNON.Vec3(1, 1, 1)); // 假设模型
			// 创建刚体并设置质量
			const boxBody = new CANNON.Body({ mass: 1 ,id: 'player'});
			// 将刚体形状添加到刚体中
			boxBody.addShape(boxShape);
			// 将刚体添加到物理世界中
			game.world.addBody(boxBody);
			// 设置刚体的位置和模型位置一致
			boxBody.position.copy(object.position);
			// 将刚体存储到模型的 userData 中，方便后续操作
			object.userData.physicsBody = boxBody;
			console.log("人物模型刚体已加载");
			const numBodies = game.world.bodies.length;
			console.log("当前物理世界中有 " + numBodies + " 个刚体。");

			player.object.add(object);

			if (player.deleted===undefined) game.scene.add(player.object);
			
			if (player.local){
				game.createCameras();
				game.sun.target = game.player.object;
				game.animations.Idle = object.animations[0];
				if (player.initSocket!==undefined) player.initSocket();
			}else{
				const geometry = new THREE.BoxGeometry(100,300,100);
				const material = new THREE.MeshBasicMaterial({visible:false});
				const box = new THREE.Mesh(geometry, material);
				box.name = "Collider";
				box.position.set(0, 150, 0);
				player.object.add(box);
				player.collider = box;
				player.object.userData.id = player.id;
				player.object.userData.remotePlayer = true;
				const players = game.initialisingPlayers.splice(game.initialisingPlayers.indexOf(this), 1);
				game.remotePlayers.push(players[0]);
			}
			
			if (game.animations.Idle!==undefined) player.action = "Idle";
		} );
	}
	
	set action(name){
		//Make a copy of the clip if this is a remote player
		if (this.actionName == name) return;
		const clip = (this.local) ? this.animations[name] : THREE.AnimationClip.parse(THREE.AnimationClip.toJSON(this.animations[name])); 
		const action = this.mixer.clipAction( clip );
        action.time = 0;
		this.mixer.stopAllAction();
		this.actionName = name;
		this.actionTime = Date.now();
		
		action.fadeIn(0.5);	
		action.play();
	}
	
	get action(){
		return this.actionName;
	}
	
	update(dt){
		this.mixer.update(dt);
		
		if (this.game.remoteData.length>0){
			let found = false;
			for(let data of this.game.remoteData){
				if (data.id != this.id) continue;
				//Found the player
				this.object.position.set( data.x, data.y, data.z );
				const euler = new THREE.Euler(data.pb, data.heading, data.pb);
				this.object.quaternion.setFromEuler( euler );
				this.action = data.action;
				found = true;
			}
			if (!found) this.game.removePlayer(this);
		}
	}
}

class PlayerLocal extends Player{
	constructor(game, model){
		super(game, model);
		
		const player = this;
		const socket = io.connect();
		socket.on('setId', function(data){
			player.id = data.id;
		});
		socket.on('remoteData', function(data){
			game.remoteData = data;
		});
		socket.on('deletePlayer', function(data){
			const players = game.remotePlayers.filter(function(player){
				if (player.id == data.id){
					return player;
				}
			});
			if (players.length>0){
				let index = game.remotePlayers.indexOf(players[0]);
				if (index!=-1){
					game.remotePlayers.splice( index, 1 );
					game.scene.remove(players[0].object);
				}
            }else{
                index = game.initialisingPlayers.indexOf(data.id);
                if (index!=-1){
                    const player = game.initialisingPlayers[index];
                    player.deleted = true;
                    game.initialisingPlayers.splice(index, 1);
                }
			}
		});
        
		socket.on('chat message', function(data){
			document.getElementById('chat').style.bottom = '0px';
			const player = game.getRemotePlayerById(data.id);
			game.speechBubble.player = player;
			game.chatSocketId = player.id;
			game.activeCamera = game.cameras.chat;
			game.speechBubble.update(data.message);
		});
        
		$('#msg-form').submit(function(e){
			socket.emit('chat message', { id:game.chatSocketId, message:$('#m').val() });
			$('#m').val('');
			return false;
		});
		
		this.socket = socket;
	}
	
	initSocket(){
		//console.log("PlayerLocal.initSocket");
		this.socket.emit('init', { 
			model:this.model, 
			colour: this.colour,
			x: this.object.position.x,
			y: this.object.position.y,
			z: this.object.position.z,
			h: this.object.rotation.y,
			pb: this.object.rotation.x
		});
	}
	
	updateSocket(){
		if (this.socket !== undefined){
			//console.log(`PlayerLocal.updateSocket - rotation(${this.object.rotation.x.toFixed(1)},${this.object.rotation.y.toFixed(1)},${this.object.rotation.z.toFixed(1)})`);
			this.socket.emit('update', {
				x: this.object.position.x,
				y: this.object.position.y,
				z: this.object.position.z,
				h: this.object.rotation.y,
				pb: this.object.rotation.x,
				action: this.action
			})
		}
	}
	
	move(dt){
		const pos = this.object.position.clone();
		pos.y += 60;
		let dir = new THREE.Vector3();
		this.object.getWorldDirection(dir);
		if (this.motion.forward<0) dir.negate();
		let raycaster = new THREE.Raycaster(pos, dir);
		let blocked = false;
		const colliders = this.game.colliders;
	
		if (colliders!==undefined){ 
			const intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				if (intersect[0].distance<50) blocked = true;
			}
		}
		
		if (!blocked){
			if (this.motion.forward>0){
				const speed = (this.action=='Running') ? 500 : 150;
				this.object.translateZ(dt*speed);
			}else{
				this.object.translateZ(-dt*30);
			}
		}
		
		if (colliders!==undefined){
			//cast left
			dir.set(-1,0,0);
			dir.applyMatrix4(this.object.matrix);
			dir.normalize();
			raycaster = new THREE.Raycaster(pos, dir);

			let intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				if (intersect[0].distance<50) this.object.translateX(100-intersect[0].distance);
			}
			
			//cast right
			dir.set(1,0,0);
			dir.applyMatrix4(this.object.matrix);
			dir.normalize();
			raycaster = new THREE.Raycaster(pos, dir);

			intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				if (intersect[0].distance<50) this.object.translateX(intersect[0].distance-100);
			}
			
			//cast down
			dir.set(0,-1,0);
			pos.y += 200;
			raycaster = new THREE.Raycaster(pos, dir);
			const gravity = 30;

			intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				const targetY = pos.y - intersect[0].distance;
				if (targetY > this.object.position.y){
					//Going up
					this.object.position.y = 0.8 * this.object.position.y + 0.2 * targetY;
					this.velocityY = 0;
				}else if (targetY < this.object.position.y){
					//Falling
					if (this.velocityY==undefined) this.velocityY = 0;
					this.velocityY += dt * gravity;
					this.object.position.y -= this.velocityY;
					if (this.object.position.y < targetY){
						this.velocityY = 0;
						this.object.position.y = targetY;
					}
				}
			}
		}
		
		this.object.rotateY(this.motion.turn*dt);
		
		this.updateSocket();
	}
}

class SpeechBubble{
	constructor(game, msg, size=1){
		this.config = { font:'Calibri', size:24, padding:10, colour:'#222', width:256, height:256 };
		
		const planeGeometry = new THREE.PlaneGeometry(size, size);
		const planeMaterial = new THREE.MeshBasicMaterial()
		this.mesh = new THREE.Mesh(planeGeometry, planeMaterial);
		game.scene.add(this.mesh);
		
		const self = this;
		const loader = new THREE.TextureLoader();
		loader.load(
			// resource URL
			`${game.assetsPath}images/speech.png`,

			// onLoad callback
			function ( texture ) {
				// in this example we create the material when the texture is loaded
				self.img = texture.image;
				self.mesh.material.map = texture;
				self.mesh.material.transparent = true;
				self.mesh.material.needsUpdate = true;
				if (msg!==undefined) self.update(msg);
			},

			// onProgress callback currently not supported
			undefined,

			// onError callback
			function ( err ) {
				console.error( 'An error happened.' );
			}
		);
	}
	
	update(msg){
		if (this.mesh===undefined) return;
		
		let context = this.context;
		
		if (this.mesh.userData.context===undefined){
			const canvas = this.createOffscreenCanvas(this.config.width, this.config.height);
			this.context = canvas.getContext('2d');
			context = this.context;
			context.font = `${this.config.size}pt ${this.config.font}`;
			context.fillStyle = this.config.colour;
			context.textAlign = 'center';
			this.mesh.material.map = new THREE.CanvasTexture(canvas);
		}
		
		const bg = this.img;
		context.clearRect(0, 0, this.config.width, this.config.height);
		context.drawImage(bg, 0, 0, bg.width, bg.height, 0, 0, this.config.width, this.config.height);
		this.wrapText(msg, context);
		
		this.mesh.material.map.needsUpdate = true;
	}
	
	createOffscreenCanvas(w, h) {
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		return canvas;
	}
	
	wrapText(text, context){
		const words = text.split(' ');
        let line = '';
		const lines = [];
		const maxWidth = this.config.width - 2*this.config.padding;
		const lineHeight = this.config.size + 8;
		
		words.forEach( function(word){
			const testLine = `${line}${word} `;
        	const metrics = context.measureText(testLine);
        	const testWidth = metrics.width;
			if (testWidth > maxWidth) {
				lines.push(line);
				line = `${word} `;
			}else {
				line = testLine;
			}
		});
		
		if (line != '') lines.push(line);
		
		let y = (this.config.height - lines.length * lineHeight)/2;
		
		lines.forEach( function(line){
			context.fillText(line, 128, y);
			y += lineHeight;
		});
	}
	
	show(pos){
		if (this.mesh!==undefined && this.player!==undefined){
			this.mesh.position.set(this.player.object.position.x, this.player.object.position.y + 380, this.player.object.position.z);
			this.mesh.lookAt(pos);
		}
	}
}
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
//导入物理引擎库
const Cannon = require('cannon');
app.use(express.static('../../public_html/blockland/'));
app.use(express.static('../../public_html/libs'));
app.use(express.static('../../public_html/blockland/v3'));


//当用户访问根路径时，发送一个文件 index.html：
app.get('/',function(req, res) {
    res.sendFile(__dirname + '../../public_html/blockland/v3/index.html');
});
//当有新的 Socket 连接时，执行一些初始化工作，并为该 Socket 分配一个唯一的 id，并将其发送给客户端：
io.sockets.on('connection', function(socket){
	socket.userData = { x:0, y:0, z:0, heading:0 };//Default values;
 
	console.log(`${socket.id} connected`);
	socket.emit('setId', { id:socket.id });
	//当有 Socket 断开连接时，向其他已连接的 Socket 广播删除消息：
    socket.on('disconnect', function(){
		socket.broadcast.emit('deletePlayer', { id: socket.id });
    });	
	//接收客户端发送的初始化消息，并更新用户数据：
	socket.on('init', function(data){
		console.log(`socket.init ${data.model}`);
		socket.userData.model = data.model;
		socket.userData.colour = data.colour;
		socket.userData.x = data.x;
		socket.userData.y = data.y;
		socket.userData.z = data.z;
		socket.userData.heading = data.h;
		socket.userData.pb = data.pb;
		socket.userData.action = "Idle";
	});
	
	socket.on('update', function(data){
		socket.userData.x = data.x;
		socket.userData.y = data.y;
		socket.userData.z = data.z;
		socket.userData.heading = data.h;
		socket.userData.pb = data.pb,
		socket.userData.action = data.action;
	});
	//接收客户端发送的聊天消息，并将其广播给指定的 Socket 客户端：
	socket.on('chat message', function(data){
		console.log(`chat message:${data.id} ${data.message}`);
		io.to(data.id).emit('chat message', { id: socket.id, message: data.message });
	})
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});
//设置定时器，每 40 毫秒向所有客户端发送用户数据：
setInterval(function(){
	const nsp = io.of('/');
    let pack = [];
	
    for(let id in io.sockets.sockets){
        const socket = nsp.connected[id];
		//Only push sockets that have been initialised
		if (socket.userData.model!==undefined){
			pack.push({
				id: socket.id,
				model: socket.userData.model,
				colour: socket.userData.colour,
				x: socket.userData.x,
				y: socket.userData.y,
				z: socket.userData.z,
				heading: socket.userData.heading,
				pb: socket.userData.pb,
				action: socket.userData.action
			});    
		}
    }
	if (pack.length>0) io.emit('remoteData', pack);
}, 40);
/**************************************
Quitalk Backend Library - ZQServer

Version : 1.0.0.0
제작 시작일 : 2015-01-16
Copyright ⓒ 2015 Quitalk.com
Author : 김현우(kookmin20103324@gmail.com)

http://hae.so
http://quitalk.com
***************************************/


//NodeJS를 사용하기 위한 라이브러리를 로드한다.
var $ =		require('jquery');
var fs =	require('fs');
var app =	require('express')();
var http =	require('http').Server(app);
var io =	require('socket.io')(http);
var mysql=	require('mysql');
var md5 =	require('js-md5');
var D =		require('JQDeferred');
//아래 라이브러리는 php file을 executing 하기 위한 setting이다.
var phpExpress = require('php-express')({binPath: 'php'});
// set view engine to php-express
app.set('views', '../');
app.engine('php', phpExpress.engine);
app.set('view engine', 'php');
// routing all .php file to php-express
app.all(/.+\.php$/, phpExpress.router);



//Server의 모든 방,유저,client session을 관리하는 배열을 선언한다. (object + 이름을 뜻하는 o~~로 지정)
var oRoom=[], oUser=[], oObject=[], oChat=[];

//파일을 라우팅 해준다.
app.get('/game.html', function(req, res)
{
	res.sendFile('/var/www/html/quitalk/game.html');
});
app.get('/css/game.css', function(req, res)
{
	res.sendFile('/var/www/html/quitalk/css/game.css');
});
app.get('/js/ZQ.php.js', function(req, res)
{
	res.sendFile('/var/www/html/quitalk/js/ZQ.php.js');
});
/********************************************************************
define Object variables
퀴즈의 진행에 필요한 변수들을 모두 정의하는 곳이다.
*********************************************************************/
var pool=mysql.createPool(
{
	host				: 'localhost',
	port				: '3306',
	user				: /*사용자 ID 입력 필요*/,
	password			: /*사용자 PW 입력 필요*/,
	database			: /*사용할 DB 선택*/,
	connectionLimit		: /*최대 생성할 Connection 지정*/,
	insecureAuth		: 'true'
});
pool.query("set names utf8");


//Config는 server 관리에 필요한 global 설정을 모아두는 곳이다.
var Config=
{
	adminToken		:[],			//관리자 토큰(Array로 관리)
	totalUser		:0,				//현재 서버의 접속자
	totalRoom		:0,				//현재 서버에서 진행되는 방의 수
	totalChat		:0,				//서버에서 진행되는 채팅 수
	totalAd			:1,				//서버에서 진행되는 광고 수
	currentAd		:1,
	maxRoomCount	:-1,			//서버에 최대한 만들 수 있는 방의 수
									//-1은 무제한을 의미하며, 서버의 성능에 따라 조절한다.
	maxPlayingUser	:10,			//한 방에서 퀴즈을 할 수 있는 유저의 수
	maxChattingUser	:20,			//단체방 최대 인원수
	needMinPlayer	:1,				//퀴즈을 시작하기 위한 최소 플레이어 수
	quizCount		:15,				//한판하는데 걸리는 퀴즈 수
	bannerCount		:8				//배너가 나오는 시기
};

//Item은 enum 형식으로 사용하기 위해 선언한 변수이다.
var Item=
{
	NOT_USED				: 0,		//아이템 사용중이 아님.
	PREVIEW_QUESTION		: 1,		//문제 미리보기 아이템
	OVEREAT					: 2,		//폭식
	ANSWER_LENGTH			: 3,		//글자 수 보는 아이템
	FEELING_LUCKY			: 4,		//복불복
	CHEATING				: 5,		//컨닝
	MAGIC_PEN				: 6,		//마법의 펜
	COPY_AND_PASTE			: 7			//복붙복붙
}

//특정 퀴즈를 빨리 풀기 위해 저장하는 정보

var trainKind = ["1","1-1","1-2","1-3","2","2-1","2-2","3","4","5","5-1","5-2","6","7","8","9","분당","인천1","신분당","경의","경의2","경춘","인천공항","의정부","수인"];
var trainCount = [74,21,3,3,44,5,6,44,48,38,6,8,39,51,17,30,36,29,6,50,3,21,11,15,10];
var trainColor = ["#00498B","#00498B","#00498B","#00498B","#009246","#009246","#009246","#F36630","#00A2D1","#A064A3","#A064A3","#A064A3","#9E4510","#5D6519","#D6406A","#A17E46","#E0A134","#6E98BB","#BB1833","#2ABFD0","#2ABFD0","#2ABFD0","#006D9D","#FF850D","#E0A134"]


//Quiz는 방의 문제를 관리하기 위해 필요한 Object이다.
//문제를 읽어오는 과정 중 sql이 비동기 과정으로 처리되기 때문에, 해당 callback에서 직접 cbstartQuizRotation 함수로 리턴한다.


//Room Object는 퀴즈이 진행중인 방에 대한 정보를 보관하는 Object이다.
//유저들의 현재 순위, 접속 정보, 접속 인원 및 예상 점수 등 모든 data가 보관된 Object이며
//이 Object들은 associative array에 저장되어 후에 방 관리에 쓰이게 된다.
function Room(User,rname)
{
	Config.totalRoom++;
	this.name				=rname;				//방의 이름
	this.currentUser		=1;					//현재 접속자 수
	this.userList			=[User];			//접속한 유저들의 user Object Array
	this.quizObject			=null;				//해당 방에 생성된 quizObject
	this.quizCount			=0;					//현재 진행된 퀴즈의 수
	this.countStarted		=false;				//카운트가 시작되었는가
	this.isStarted			=false;				//퀴즈이 시작되었는가
	this.isFinished			=false;				//퀴즈가 종료된 방인가
	this.isPlayedQuiz		=false;				//퀴즈가 진행중인가
	this.isFriendShip		=false;				//친선모드인가
	this.advertise			=Config.currentAd;	//광고 유형
	this.stackScore			=0;					//맞춘 사람이 아무도 없을 경우 점수가 누적된다.

	Config.currentAd++;
	if(Config.currentAd>Config.totalAd)Config.currentAd=1;
	//Room 정보에 가지고 있는 typeArray를 통해 문제를 균등하게 출제할 수 있게 한다.
	//2015-07-22 각 유형에 대해 문제는 최소 0, 최대 3문제까지 출제될 수 있다.
	//문제수가 많은 3번(자음), 4번(이미지), 9번(지하철역)은 1개씩 출제하며, 나머지는 3개씩 기회를 부여(3,4,9는 2개) 하여
	//랜덤으로 문제를 고른다.
	
	this.typeArray		=[3,3,3,3,3,3,3,4,4,4,4,4];					//필수 문제
	var etcType			=[1,1,1,2,2,2,5,5,5,6,6,6,7,7,7,8,8,8,9,9,10,10,10,11,11];	//선택 문제
	etcType				=shuffle(etcType);
	var remainCount = 15-this.typeArray.length;
	for(var i=0;i<remainCount;i++) this.typeArray.push(etcType[i]);
	this.typeArray		=shuffle(this.typeArray);

	return this;
}

function Chat(User)
{
	Config.totalChat++;
	this.count				= 0;			//멤버 카운트
	this.members			= [User];		//멤버들의 User 객체를 가지고 있는다.
	this.groupPlay			= 0;			//같이하기
	this.agree				= [];
	this.instantQuiz		= null;			//인스턴트 퀴즈
	this.lastQuizTime		= null;			//마지막 퀴즈 출제 시간	
	this.requestGroupPlay	= false;		//같이하기 요청을 했었는가
}

function Quiz(rname,type)
{
	var self=this;

	//typeArray에 있는 값을 하나씩 빼오면서 퀴즈를 만든다.
	var qtype=oRoom[rname].typeArray[0];
	oRoom[rname].typeArray.splice(0,1);
	
	//2015-07-19 지하철 노선도 퀴즈의 경우 index array에서 값을 뽑아온뒤, 3개를 불러온다.
	//그 뒤 내부 callback function에서 qtype을 체크하여 9일 경우 추가 작업을 해준다.
	var sql="";
	var rand=0;
	if(qtype==9)
	{
		rand = Math.floor(Math.random()*trainKind.length);
		var no = Math.floor(Math.random()*(trainCount[rand]-2)+2)-1;
		
		//현재 번호를 기준으로 자기를 포함한 3개의 역을 불러온다. 그럼 rows[1]에 있는 것이 답이 된다.
		sql = "select * from quitalk_question where type="+qtype+" and category="+pool.escape(trainKind[rand])+" and (question="+pool.escape(no)+" or question="+pool.escape(no+1)+" or question="+pool.escape(no+2)+")";
	}
	else if(qtype==11)
	{
		var str="";
		var type=["+","-","*"];
		for(var i=0;i<4;i++)
		{
			rand = Math.floor(Math.random()*10);
			str+=rand;
			rand = Math.floor(Math.random()*3);
			str+=type[rand];
		}
		rand = Math.floor(Math.random()*10);
		str+=rand;
		self.type			=11;
		self.category		="암산왕";
		self.question		=str+"=?";
		self.answer			=eval(str).toString();
		self.hintCount		=0;
		self.hintArray		=getHintArray(self.answer);
		self.questionTime	=null;
		oRoom[rname].quizObject = self;
		return;
	}
	else sql="select * from quitalk_question where type="+qtype+" order by rand() limit 0,1";
	pool.query(sql,function(err,rows,fields)
	{
		if(!err)
		{
			if(qtype==9)
			{
				//3개의 rows 중 답은 rows[1] 것으로 해야 하며, 여기서 tag를 아예 생성한다.
				if(rand%2==0)
				{
					var str="<div style='width:90%; background-color:"+trainColor[rand]+"; height:25px; color:#eeeeee; font-weight:700; padding:5px 0 0 0;'>";
					if(typeof(rows[0])!="undefined")
						str+="("+rows[0].answer+") --- (&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp)";
					if(typeof(rows[2])!="undefined")
						str+=" --- ("+rows[2].answer+")";
					str+="</div>";
				}
				else
				{
					var str="<div style='width:90%; background-color:"+trainColor[rand]+"; height:25px; color:#eeeeee; font-weight:700; padding:5px 0 0 0;'>";
					if(typeof(rows[2])!="undefined")
						str+="("+rows[2].answer+") --- (&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp)";
					if(typeof(rows[0])!="undefined")
						str+=" --- ("+rows[0].answer+")";
					str+="</div>";
				}
				self.type			=rows[1].type;
				self.category		=rows[1].category;
				self.question		=str;
				self.answer			=rows[1].answer;
				self.hintCount		=0;
				self.hintArray		=getHintArray(self.answer);
				self.questionTime	=null;

				//출제횟수 증가는 rows[1] 번만 한다.
				pool.query("update quitalk_question set total=total+1 where no='"+rows[1].no+"'");
				oRoom[rname].quizObject = self;
			}
			else
			{
				//넘겨받은 query의 value를 setting 한다.
				self.type			=rows[0].type;
				self.category		=rows[0].category;
				self.question		=rows[0].question;
				self.answer			=rows[0].answer;
				self.hintCount		=0;
				self.hintArray		=getHintArray(self.answer);
				self.questionTime	=null;

				//출제횟수 증가
				pool.query("update quitalk_question set total=total+1 where no='"+rows[0].no+"'");
				oRoom[rname].quizObject = self;
			}
		}
	});
}

function InstantQuiz(cname)
{
	var self=this;

	var sql="select * from quitalk_question order by rand() limit 0,1";
	pool.query(sql,function(err,rows,fields)
	{
		if(!err)
		{
			//넘겨받은 query의 value를 setting 한다.
			self.type			=rows[0].type;
			self.category		=rows[0].category;
			self.question		=rows[0].question;
			self.answer			=rows[0].answer;
			self.hintCount		=0;
			self.hintArray		=getHintArray(self.answer);
			self.questionTime	=null;
			oChat[cname].instantQuiz = self;
			printInstantQuiz(cname);
		}
	});
}
/*
User Object는 최초 접속 시 token과 기본 정보를 토대로 DB에서 추출하여 저장한다.
단, 이 Object는 send된 정보를 기반으로 parentObject 형식으로 객체를 얻을 수 없으므로
id를 기준으로 associative 하여 저장한다. 즉, oUser[id] 형식으로 저장하여 token 일치
여부 확인 후 정보를 수행하면 된다. User는 user Object, oUser는 associative array를 의미한다.
*/
function User(client,ID,token)
{
	
	var self	=this;
	var query	="select * from quitalk_member where email='"+ID+"'";
	var sql		=pool.query(query, function(err,rows)
	{
		if(err)
		{
			client.emit('qerror','DBerror');
		}
		else
		{
			var uID,uNickname,uBalloonSkin,uRate,uBlocked,uGuest;
			//2015-08-23 비회원도 게임 이용이 가능하게 한다.
			if(!rows.length)
			{
				uID = ID;
				uNickname = "손님_"+md5(uID).substr(4,6);
				uRate = 500;
				uBalloonSkin=0;
				uBlocked = "0";
				uGuest = true;
			}
			else
			{
				uID = rows[0].email;
				uNickname = rows[0].nickname;
				uRate = rows[0].rate;
				uBalloonSkin = rows[0].balloonskin;
				uBlocked = rows[0].blocked;
				uGuest = false;
			}
			var chkToken=md5("qui"+uID+"talk"+uNickname);
			if(err || token!=chkToken)
			{
				client.emit('qerror','invalidToken');
			}
			else if(uBlocked=="1")
			{
				client.emit('qerror','blocked');
			}
			else
			{
				if(typeof(oUser[ID])!="undefined")
				{
					Config.totalUser--;
					//중복된 계정이 발견되면 해당 계정을 다시 접속시킨다.
					oUser[ID].queue.emit('qerror','duplicate');
					oUser.splice(ID,1);
					client.emit('receive','chat','퀴톡','중복으로 접속하여 기존 계정의 접속이 종료됩니다.');
				}
				self.isGuest		=uGuest;				//비회원인가
				self.ID				=uID;					//유저의 이메일주소
				self.nickname		=uNickname;				//유저의 닉네임
				self.place			=-1;					//현재 접속한 방
				self.balloonskin	=uBalloonSkin;			//현재 적용중인 말풍선 스킨
				self.iconskin		=[];					//보유중인 아이콘 스킨(밑의 함수에서 적용)
				self.answer			="";					//퀴즈 진행시 유저가 입력한 정답
				self.answerTime		=null;					//유저가 정답을 입력한 시간(순위 제출용)
				self.token			=chkToken;				//토큰 저장
				self.score			=0;						//퀴즈를 맞춘 갯수
				self.rate			=uRate;					//현재 유저의 rating
				self.rank			=0;						//현재 유저의 랭킹
				self.winRate		=0;						//퀴즈 진행시 승리할 경우 받는 보상
				self.loseRate		=0;						//퀴즈 진행시 패배할 경우 받는 보상
				self.lastSendTime	=new Date().getTime();	//마지막으로 채팅을 보낸 시간
				self.isBlocked		=false;					//채팅이 금지되어 있는가
				self.queue			=client;				//메시지를 받을 수 있는 개인 큐
				self.usedItem		=0;						//퀴즈 푸는 도중 사용한 아이템
				self.useItemCount	=0;						//아이템 사용 횟수(2회까지만 사용가능하므로)
				self.chatList		=[];					//채팅방 목록
				self.feelingLucky	=false;					//복불복 아이템 적용
				self.advertise		=0;						//광고 적용(게임 끝난 후)
				Config.totalUser++;							//총 유저 증가
				client.emit('receive','greet',Config.totalUser);
				oUser[self.ID]=self;
				//2015-06-22 추가
				//unique identifier는 client.id에 있다.
				oObject[client.id]=self.ID;
				
				//인증 콜백함수 실행
				cbUserAuth(client,ID,token);

				//아이콘 적용 시작
				getUserIconList(self);
			}
		}
	});
}


/*
client.emit은 해당 client에게만 전송을 하는 것이다.
client.broadcast.emit은 나머지 인원들에게 broadcast 하는 것이다.
io.sockets.emit은 전역으로 전송하는 것이다.
emit의 parameter는 갯수의 제한이 없다.
*/

//전 채널에 있는 모든 유저들에게 10초에 1번씩 전체 접속 인원을 보내준다.
setInterval(function()
{
	io.sockets.emit('receive','count',Config.totalUser);
},10000);

io.on('connection', function(client)
{
	
	client.emit('init');//접속 user에게 정보를 요구한다.

	client.on('auth',function(ID,token)
	{
		userAuth(client,ID,token);
	});

	//2015-07-08 socket io 내부에서 exception 발생시
	//발생된 client를 reconnect 시키고, log를 남기도록 한다.
	client.on('error',function(error)
	{
		var tid=oObject[client.id];
		//1일 단위로 파일이 바뀌게 저장을 한다.
		var fileName = new Date().toISOString().slice(0,10).replace(/-/g,"");
		var data="\n"+oUser[tid].nickname+"("+tid+"), 시간 : "+new Date()+"\n oUser 정보 : "+convertString(oUser[tid])+"\n\nerror:\n"+error.stack+"\n";
		fs.appendFileSync("./logs/"+fileName+md5(fileName)+".log",data);
		fs.chmodSync("./logs/"+fileName+md5(fileName)+".log", '0777');
		//디버깅용 source
		console.log(error.stack);
		//퀴즈가 진행중이라도 패널티를 받지 않도록 수정한다.
		oUser[tid].winRate = 0;
		client.emit("receive","exception");
	}
	);

	//유저가 접속을 끊었을 경우 퀴즈 진행중이라면 패널티를 먹인다.
	//또한 퀴즈 정보에 메시지를 알리고 방에서 제거 작업을 실시한다.
	client.on('disconnect',function(ID,token)
	{
		var tid=oObject[client.id];
		//접속하지 않은 인원의 disconnect 명령은 무시한다.
		if(typeof(oUser[tid])!="undefined")
		{
			//토탈인원을 삭제해준다.
			Config.totalUser--;

			
			//해당 id가 퀴즈중인지 검사한다. winRate가 설정되어 있다면 퀴즈중이다.
			if(oUser[tid].place != -1 && oRoom[oUser[tid].place].isFinished && oRoom[oUser[tid].place].quizCount < 15)
			{
				//퀴즈중이라면 벌점 30점을 먹인다.
				var query	="update quitalk_member set rate=rate-30 where email='"+tid+"'";
				pool.query(query);
			}
			//유저가 방에 있었다면 해당 방의 유저들에게  exit 사실을 알려준다.
			//또한 방의 접속 기록을 모두 삭제한다.
			if(oUser[tid].place!=-1)
			{
				var rname=oUser[tid].place;
				io.sockets.in(rname).emit('receive','userExit',oUser[tid].nickname);
				oRoom[rname].currentUser--;
				for(var i=0;i<oRoom[rname].userList.length; i++)
				{
					if(tid == oRoom[rname].userList[i])
					{
						oRoom[ranme].userList.splice(i,1);
						break;
					}
				}

				//자신이 마지막 유저라면 방을 제거해준다.
				if(!oRoom[rname].currentUser)
				{
					Config.totalRoom--;
					delete oRoom[rname];
				}

				oUser[tid].queue.leave(rname);
			}
			//유저가 들어가 있는 방에 퇴장 명령을 내린다.
			for(var i=0; i<oUser[tid].chatList.length; i++)
			{
				
				var cname=oUser[tid].chatList[i];
				if(typeof(oChat[cname]) == 'undefined') continue;
				io.sockets.in(oUser[tid].chatList[i]).emit('receive','chatExit',cname,oUser[tid].nickname);
				//혼자 남았을 경우 해당 채팅방을 제거한다. 단체방일 경우는 감소만 시킨다.
				if(oChat[cname].count == 2)
				{
					io.sockets.in(oUser[tid].chatList[i]).emit('receive','chatDestroy',cname);
					Config.totalChat--;
					delete oChat[cname];
					oUser[tid].queue.leave(cname);
				}
				else
				{
					oChat[cname].count--;
					oChat[cname].members.remove(oUser[tid]);
				}
			}
			//id의 정보와 client 정보를 모두 삭제한다.
			delete oUser[tid];
			delete oObject[client];
		}
	}
	);

	//send쿼리는 command에 따라 명령을 다르게 처리한다.
	client.on('send',function(command,ID,token,msg,etc1,etc2)
	{
		//user가 보내온 ID를 통해 oUser의 token을 먼저 비교한다.
		//typeof oUser[ID] !=="undefined" 를 먼저 해주는 이유는, oUser[ID] 자체가 없으면
		//oUser[ID].token 자체를 비교하려는 순간 에러가 나기 때문이다. 2015-05-18 드디어 해결
		if(typeof token !="undefined" && typeof oUser[ID] !="undefined" && typeof oUser[ID].token !="undefined" && token==oUser[ID].token)
		{
			//유저의 일반적인 채팅 쿼리
			if(command=="chat") userRoomChat(ID,token,msg);
			if(command=="chat2") userRoomChat2(ID,msg,etc1);
			else if(command=="findroom") findRoom(client,ID);
			else if(command=="userInfo") sendRoomUserInfo(client,ID);
			else if(command=="useItem") useItem(client,ID,msg);
			//방을 나가는 경우
			else if(command=="exitRoom")
			{
				//방에서 보낸 신호일 경우에만 반응시킨다.
				if(oUser[ID].place != -1) exitRoom(client,ID);
			}
			else if(command=="friendList") getFriendList(client,ID);
			else if(command=="addFriendRequest") addFriendRequest(client,ID,msg);
			else if(command=="acceptFriendRequest") acceptFriendRequest(client,ID,msg);

			else if(command=="denyFriendRequest")
			{
				var fnick = msg;

				//request에 요청이 있는지 확인한다.
				var sql = "delete from quitalk_friend_request where (qto = "+pool.escape(fnick)+" and qfrom = "+pool.escape(oUser[ID].nickname)+") or (qto = "+pool.escape(oUser[ID].nickname)+" and qfrom = "+pool.escape(fnick)+")";
				pool.query(sql,function(err,rows,fields)
				{
					if(!err)
					{
						client.emit('receive','refreshFriendList');
					}
					else client.emit('receive','alertError',"친구신청이 취소되었거나 일시적인 오류입니다.\n친구목록을 다시 불러와주세요.");
				});
			}
			else if(command=="deleteFriend")
			{
				//친구 삭제는 한쪽에서 할 경우 반대쪽에서도 자동으로 삭제된다.
				var fnick = msg;
				var sql="delete from quitalk_friend where (friend1nick = "+pool.escape(fnick)+" and friend2nick = "+pool.escape(oUser[ID].nickname)+") or (friend2nick = "+pool.escape(fnick)+" and friend1nick = "+pool.escape(oUser[ID].nickname)+")";
				pool.query(sql,function(err,rows,fields)
				{
					if(!err)
					{
						client.emit('receive','refreshFriendList');
					}
				});
			}
			else if(command=="blockFriend")
			{
				var fnick = msg;
				var sql="select * from quitalk_friend_block where qto="+pool.escape(fnick)+" and qfrom="+pool.escape(oUser[ID].nickname);
				pool.query(sql,function(err,rows,fields)
				{
					if(rows.length<1)
					{
						var sql="insert quitalk_friend_block(qto,qfrom) values("+pool.escape(fnick)+","+pool.escape(oUser[ID].nickname)+")";
						pool.query(sql);
						client.emit('receive','alertError','차단이 완료되었습니다.');
					}
				});
			}
			else if(command=="makePrivateChat")
			{
				if(typeof(msg)=="object" && msg.length>Config.maxChattingUser)
					client.emit('receive','alertError',Config.maxChattingUser+'명 이상의 방은 만들 수 없습니다.');
				else
				{
					if(!isAlreadyExistsRoom(oUser[ID],msg,etc1))
						makePrivateChat(oUser[ID],msg,etc1);
				}
				//존재하는 방의 경우 부득이하게 isAlreadyExistsRoom function에서 존재하는 방임을 알려주는 패킷을 보내도록 했다.
			}
			else if(command=="requestGroupPlay") requestGroupPlay(ID,msg);
			else if(command=="agreeGroupPlay") agreeGroupPlay(ID,msg);
			else if(command=="getInstantQuiz") getInstantQuiz(ID,msg);
			else if(command=="inviteFriend") getInviteFriendList(client,ID,msg);//2015-08-02여기서는 먼저 친구목록을 띄워 초대 리스트를 만들게 한다.
			else if(command=="invitePrivateChat") invitePrivateChat(oUser[ID],msg,etc1);
			else if(command=="reserveAdvertise")
			{
				if(!oUser[ID].advertise)
				{
					oUser[ID].advertise = oRoom[oUser[ID].place].advertise;
					client.emit('receive','globalChat',"퀴즈 종료 후 퇴장 시 광고가 열리고 보상을 받습니다!","chatting_view");
				}
			}
		}
		else
		{
			if(typeof(oUser[ID]) == "undefined")
				client.emit('receive','refresh');
			else
				client.emit('qerror','invalidToken');
		}
	});
});

//////////////////////////////////////
//접속 및 로비에서의 기본 처리 함수 모음//
/////////////////////////////////////
//유저의 인증 함수
function userAuth(client,ID,token)
{
	//생성자를 호출하여 유저의 정보를 넣어준다.
	var user=new User(client,ID,token);
}

//비동기 처리 후 실행되는 유저의 인증 함수
function cbUserAuth(client,ID,token)
{
	if(!oUser[ID].isGuest)
	{
		var sql = "SELECT count(*) FROM `quitalk_member` WHERE rate > (select rate from quitalk_member where email="+pool.escape(ID)+")";
		pool.query(sql,function(err,rows,fields)
		{
			if(oUser[ID].isGuest)
			{
				oUser[ID].rank = 0;
			}
			else
			{
				for(var key in rows[0])
				{
					oUser[ID].rank = rows[0][key]+1;
				}
			}
			//준비 완료 상태를 알린다.
			client.emit('receive','ready',oUser[ID].rate,oUser[ID].rank);

			//친구 신청이 들어온 경우, 메세지를 통해 알려준다.
			var sql = "select * from quitalk_friend_request where qto="+pool.escape(oUser[ID].nickname);
			pool.query(sql,function(err,rows,field)
			{
				if(rows.length>0)
					client.emit('receive','waitFriendRequest',rows.length);
			});
		});
	}
	else
	{
		client.emit('receive','ready',oUser[ID].rate,oUser[ID].rank);
		client.emit('receive','globalChat',"현재 로그인을 하지 않으셨습니다.<br>비회원은 문제를 풀어도 점수와 포인트를 얻지 못하며<br> 이벤트 참여가 불가능합니다.<br>지금, 퀴톡에 가입해 보세요!(로그인 버튼 클릭)","chatting_view");
	}
}

function getUserIconList(User)
{
	//1번은 말풍선, 2번은 채팅 아이콘 스킨
	var sql = "select * from quitalk_items where email="+pool.escape(User.ID)+" and type=2 order by value asc";
	pool.query(sql, function(err,rows,field)
	{
		if(rows.length>0)
		{
			for(var i=0;i<rows.length;i++)
				User.iconskin.push(rows[i].value);
			//list를 client한테도 보내 적용시킨다.
			User.queue.emit('receive','iconList',User.iconskin.join(","));
		}
	});
}

//방에 접속한 유저의 목록을 refresh 해주는 함수이다.
function refreshRoomUserList(rname)
{
	var str="<span style='font-size:11px;'>";

	for(var i in oRoom[rname].userList)
	{
		str+=oRoom[rname].userList[i].nickname+"("+oRoom[rname].userList[i].rate+") | ";
	}
	str+="</span>";
	io.sockets.in(rname).emit('receive','refreshUserList',str,oRoom[rname].currentUser);
}

function findRoom(client,ID)
{
	if(oUser[ID].place==-1)
	{
		//2015-07-07
		//새로운 방에 들어가기 전 기본 정보를 초기화 시킨다.
		oUser[ID].winRate = 0;
		oUser[ID].loseRate = 0;
		oUser[ID].score = 0;
		oUser[ID].answer = "";
		oUser[ID].usedItem = 0;
		oUser[ID].useItemCount = 0;
		oUser[ID].feelingLucky	= false;
		//room Array를 linear하게 검색을 하여 mmr을 체크한다.
		var find=false;
		var rno=0;
		var rname="";
		for(var i in oRoom)
		{
			//최고 유저와의 격차 등을 비교해준다.(추후에 인기가 많아지면)
			//지금은 방이 존재하고, 시작중이 아니며 인원수가 남았을 경우 입장을 시킨다.
			//2015-07-26 친선전인 방에는 외부인의 접근이 제한된다.
			if(!oRoom[i].isStarted && !oRoom[i].isFinished && !oRoom[i].isFriendShip && oRoom[i].currentUser<Config.maxPlayingUser)
			{
				//방에 입장을 시킨다.
				oRoom[i].currentUser++;
				oRoom[i].userList.push(oUser[ID]);							
				rname=oRoom[i].name;

				//방의 구성은 다음과 같다. room{timestamp}
				oUser[ID].place=rname;
				client.join(rname);

				//다른 유저들에게 접속 사실을 알린다.
				io.sockets.in(rname).emit('receive','userJoin',oUser[ID].nickname,oUser[ID].rate,oUser[ID].rank);
				refreshRoomUserList(rname);
				
				find=true;
				break;
			}
		}
		if(find==false)	
		{
			//방을 찾을 수 없다면, 방을 만든다.
			//방의 no는 다음과 같다. room+timestamp를 찍은 방이 그 방이다.
			//만에하나 같은 배열이 있을 수 있으므로, 존재할 경우 1씩 증가시켜준다.

			rno=new Date().getTime();
			while(typeof(oRoom['room'+rno]) != "undefined")rno--;
			rname='room'+rno;
			var troom=new Room(oUser[ID],rname);
			oRoom[rname] = troom;
			oUser[ID].place=rname;
			client.join(rname);
		}
		//방에 대한 유저의 정보를 갱신해서 보내준다.
		client.emit('receive','joinRoom',oRoom[rname].currentUser);
		//2015-07-31 자기 자신에게도 알린다.
		client.emit('receive','userJoin',oUser[ID].nickname,oUser[ID].rate,oUser[ID].rank);

		//방에 접속한 인원의 목록을 갱신한다.
		refreshRoomUserList(rname);

		if(oRoom[rname].currentUser>=Config.needMinPlayer && !oRoom[rname].isStarted && !oRoom[rname].countStarted)
		{
			startQuizCountdown(rname);
		}
	}
}

function findRoomByGroup(cname)
{
	//방 구성인원중 1명이라도 게임을 진행중이거나 존재하지 않는다면, 게임 진행을 하지 않는다.
	for(var i=0;i<oChat[cname].members.length;i++)
	{
		if(typeof(oUser[oChat[cname].members[i].ID]) == 'undefined')
		{
			io.sockets.in(cname).emit('receive','globalChat',"구성원중 로그아웃한 인원이 있어 같이하기가 취소되었습니다.",cname);
			return;
		}
		if(oChat[cname].members[i].place != -1)
		{
			io.sockets.in(cname).emit('receive','globalChat',"구성원중 퀴즈를 진행중인 인원이 있어<br> 같이하기가 취소되었습니다.",cname);
			return;
		}
	}
	//room Array를 linear하게 검색을 하여 mmr을 체크한다.
	var find=false;
	var friendShip = false;
	var rno=0;
	var rname="";
	var groupCount = oChat[cname].count;

	//2015-07-26 단체방의 인원수가 3명이 넘어가는 경우에는 그냥 방을 만들고, 친선모드를 킨다.
	if(groupCount > 2)
	{
		find=false;
		friendShip = true;
	}
	else
	{	
		for(var i in oRoom)
		{
			//방의 count와 비교를 시작한다.
			//2015-07-26 친선전인 방에는 외부인의 접근이 제한된다.
			if(!oRoom[i].isStarted && !oRoom[i].isFinished && !oRoom[i].isFriendShip && oRoom[i].currentUser+groupCount<=Config.maxPlayingUser)
			{
				//방에 입장을 시킨다.
				oRoom[i].currentUser+=groupCount;

				//room의 queue 정보를 room으로 모두 옮긴다.
				oRoom[i].userList = oRoom[i].userList.concat(oChat[cname].members);
				rname=oRoom[i].name;

				for(var i=0;i<oChat[cname].members.length;i++)
				{
					var ID = oChat[cname].members[i].ID;
					oUser[ID].place=rname;
					oUser[ID].queue.join(rname);
					io.sockets.in(rname).emit('receive','userJoin',oUser[ID].nickname,oUser[ID].rate);
				}

				//다른 유저들에게 접속 사실을 알린다.
				
				refreshRoomUserList(rname);
				find=true;
				break;
			}
		}
	}
	if(find==false)	
	{
		//방을 찾을 수 없다면, 방을 만든다.
		//방의 no는 다음과 같다. room+timestamp를 찍은 방이 그 방이다.
		//만에하나 같은 배열이 있을 수 있으므로, 존재할 경우 1씩 증가시켜준다.

		rno=new Date().getTime();
		while(typeof(oRoom['room'+rno]) != "undefined")rno--;
		rname='room'+rno;

		

		//첫번째 인덱스 유저를 넣고 방을 만든다.
		var troom=new Room(oChat[cname].members[0],rname);

		oRoom[rname] = troom;
		oRoom[rname].currentUser += groupCount - 1;

		oRoom[rname].userList = oChat[cname].members.slice();

		oUser[oChat[cname].members[0].ID].place = rname;
		oUser[oChat[cname].members[0].ID].queue.join(rname);
		
		//나머지 멤버를 모두 넣어준다.
		for(var i=1;i<oChat[cname].members.length;i++)
		{
			var ID = oChat[cname].members[i].ID;
			oUser[ID].place=rname;
			oUser[ID].queue.join(rname);
		}

		//친선모드가 적용된 방에는 결과 레이팅이 적용되지 않는다.
		if(friendShip)
			oRoom[rname].isFriendShip=true;
	}
	//방에 대한 유저의 정보를 갱신해서 보내준다.
	io.sockets.in(cname).emit('receive','joinRoom',oRoom[rname].currentUser);

	//방에 접속한 인원의 목록을 갱신한다.
	refreshRoomUserList(rname);

	if(oRoom[rname].currentUser>=Config.needMinPlayer && !oRoom[rname].isStarted && !oRoom[rname].countStarted)
	{
		startQuizCountdown(rname);
	}
}

function startQuizCountdown(rname)
{
	//인원수가 최소 인원수를 만족하면, 자동으로 퀴즈을 시작한다.
	oRoom[rname].countStarted=true;
			
	io.sockets.in(rname).emit('receive','gameStart');

	//해당 room에 Quiz를 생성한다.
	makeQuiz(rname);

	if(oRoom[rname].isFriendShip)
		io.sockets.in(rname).emit('receive','globalChat','해당 게임은 친선모드이므로 레이팅에 변동이 없습니다.',"chatting_view");

	//퀴즈 시작 5초전 부터는 입장이 불가능하다.
	//퀴즈 시작 5초전에 최소인원이 성립되지 않으면 게임이 취소된다.
	setTimeout(function()
	{
		if(typeof(oRoom[rname]) != "undefined")
		{
			if(oRoom[rname].currentUser<Config.needMinPlayer)
				oRoom[rname].isStarted=false;
			else
				oRoom[rname].isStarted=true;
			io.sockets.in(rname).emit('receive','globalChat','퀴즈 시작까지 5초 남았습니다.',"chatting_view");
		}
	},15000);

	//기존 시스템에서는 문제는 서버와 클라이언트의 대화로 출제하였지만, 이번 시스템에서는 체제적으로 유지된
	//퀴즈 함수를 15번 반복하여 돌린다.
			
	//유저가 얻게 될 Ladder 점수를 환산한다.
	setTimeout(function()
	{
		if(typeof(oRoom[rname]) != "undefined")
		{
			oRoom[rname].isFinished=true;
			setUserLadderScore(rname);
		}
	},15100);
	setTimeout(function()
	{
		startQuizRotation(rname);
	},20000);
}

function exitRoom(client,ID)
{
	var rname=oUser[ID].place;
	if(typeof(oRoom[rname])!="undefined")
	{
		//해당 id가 퀴즈중인지 검사한다. winRate가 설정되어 있다면 퀴즈중이다.
		if(!oRoom[rname].isFriendShip && oRoom[rname].isFinished && oRoom[rname].quizCount < 15)
		{
			//2015-08-10 퀴즈 진행중 기준을 퀴즈 진행 갯수가 15보다 작을때로 변경
			var query	="update quitalk_member set rate=rate-30 where email="+pool.escape(oUser[ID].ID);
			oUser[ID].rate -= 30;
			pool.query(query);
		}
		//방 인원수를 줄이고 리스트에서 제거한다.
		oRoom[rname].currentUser--;
		for(var i=0;i<oRoom[rname].userList.length; i++)
		{
			if(ID == oRoom[rname].userList[i].ID)
			{
				oRoom[rname].userList.splice(i,1);
				break;
			}
		}
		oUser[ID].place = -1;
		client.leave(rname);
			//방의 유저들에게 퇴장사실을 알린다.
		io.sockets.in(rname).emit('receive','userExit',oUser[ID].nickname);
		refreshRoomUserList(rname);
			//유저의 인원수가 최소 인원수에 도달하지 못한다면 게임을 강제로 종료한다.
		if(oRoom[rname].currentUser<Config.needMinPlayer && oRoom[rname].isStarted==true)
		{
			oRoom[rname].isStarted=false;
		}
		//만약 남은 인원이 없다면 방을 폭파한다.
		if(oRoom[rname].currentUser==0)
		{
			Config.totalRoom--;
			delete oRoom[rname];
		}
	}
		//2015-07-31 유저의 랭킹을 갱신해준다.
	var sql = "SELECT count(*) FROM `quitalk_member` WHERE rate > (select rate from quitalk_member where email="+pool.escape(ID)+")";
	pool.query(sql,function(err,rows,fields)
	{
		if(oUser[ID].isGuest)
		{
			oUser[ID].rank = 0;
		}
		else
		{
			for(var key in rows[0])
			{
				oUser[ID].rank = rows[0][key]+1;
			}
		}
		//client의 화면을 갱신해준다.
		client.emit('receive','exitRoom',oUser[ID].rate,oUser[ID].rank);
		client.emit('receive','count',Config.totalUser);
	});

	//2015-08-04 유저가 광고보기를 진행하였다면, 광고를 띄운다.
	if(oUser[ID].advertise)
	{
		var adno = oUser[ID].advertise;
		oUser[ID].advertise = 0;
		oUser[ID].queue.emit('receive','openAd',adno);
		setTimeout(function(){oUser[ID].queue.emit('receive','globalChat',"팝업차단으로 열리지 않을 경우 링크를 클릭하시면 보상을 받습니다.<br>팝업설정을 허용으로 변경해 주세요.<a href='http://quitalk.com/ad.php?no="+adno+"' target='_blank'>광고보기</a>","chatting_view");},1000);
	}
}

//방에 접속한 유저가 같은 방에 있는 유저 목록을 호출할 경우 보내주는 함수
function sendRoomUserInfo(client,ID)
{
	var rname = oUser[ID].place , str="";
	for (var i=0; i<oRoom[rname].userList.length; i++)
	{
		str+=oRoom[rname].userList[i].nickname+"|"+oRoom[rname].userList[i].rate;
		if(i!=oRoom[rname].userList.length-1)str+="|";
	}
	client.emit('receive','userInfo',str);
}

//일반 퀴즈방에서 채팅을 하는 함수
function userRoomChat(ID,token,msg)
{
	var cmd=false;
	//2015-07-21관리자 명령어 추가
	if(Config.adminToken.indexOf(token) != -1)
	{
		msgarr = msg.split(' ');
		for(var i=0;i<msg.length;i++)msgarr[i]=String(msgarr[i]);
		if(msgarr[0]=="/info")
		{
			cmd=true;
			var str="";
			for(var i in oUser)
			{
				str+=oUser[i].nickname+",";
			}
			oUser[ID].queue.emit('receive','globalChat',"총 접속 유저 : "+Config.totalUser+"<br>총 생성된 방 : "+Config.totalRoom+"<br>진행중인 대화방 : "+Config.totalChat+"<br>"+str,"chatting_view");
		}
		else if(msgarr[0]=="/nm")
		{
			cmd=true;
			if(typeof(msgarr[1])!="undefined")
			{
				Config.needMinPlayer = msgarr[1];
				oUser[ID].queue.emit('receive','globalChat',"게임 최소 플레이 가능 유저가"+ msgarr[1]+" 명으로 변경되었습니다.","chatting_view");
			}
		}
		else if(msgarr[0]=="/qc")
		{
			cmd=true;
			if(typeof(msgarr[1])!="undefined")
			{
				Config.quizCount = msgarr[1];
				oUser[ID].queue.emit('receive','globalChat',"1판의 플레이 퀴즈 수가"+ msgarr[1]+" 개로 변경되었습니다.","chatting_view");
			}
		}
		else if(msgarr[0]=="/ad")
		{
			cmd=true;
			if(typeof(msgarr[1])!="undefined")
			{
				Config.totalAd = msgarr[1];
				oUser[ID].queue.emit('receive','globalChat',"광고 진행 갯수가"+ msgarr[1]+" 개로 변경되었습니다.","chatting_view");
			}
		}
	}
	//유저가 대기실에 있을 때는 채팅이 되지 않는다.
	if(oUser[ID].place!=-1)
	{
		if(cmd)return;
		//메시지의 tag를 모두 지우고, \n을 <br>로 바꾼다.
		msg=strip_tags(msg);
		msg=msg.replace(/\n/g, "&nbsp;"); 
		if(msg.length>0)
		{
			//2015-08-02 도배를 통한 퀴즈 풀이 방해 방지
			//퀴즈방에서는 2.5초에 1번씩 채팅할 수 있다.(과도한 정답 제출 방지)
			var curTime = new Date().getTime();
			if(curTime - oUser[ID].lastSendTime <=2500)
			{
				var last = (2.500 - ((curTime - oUser[ID].lastSendTime) / 1000)).toFixed(1);
				oUser[ID].queue.emit('receive','globalChat',last+"초 후에 채팅이 가능합니다.","chatting_view");
				return;
			}
			msg=replaceIcon(ID,msg);
			if(oRoom[oUser[ID].place].isPlayedQuiz==true)
			{
				//2015-05-25 퀴즈를 풀 경우의 알고리즘 수정
				//userList에 직접 for문을 돌려 컨닝 아이템을 쓰고 있는 유저에게는 정상적으로 보낸다.
				oUser[ID].lastSendTime = curTime;
				var rname=oUser[ID].place;
				var first=false;
				if(oUser[ID].answer=="")first=true;
				oUser[ID].answer=msg;
				oUser[ID].answerTime=new Date().valueOf();
				for(var i=0; i<oRoom[rname].userList.length; i++)
				{	
					if(oRoom[rname].userList[i].usedItem == Item.CHEATING)	//컨닝 아이템을 사용중이라면
					{
						//2015-07-10 chat 명령어에서 말풍선 및 아이콘 스킨 정보를 보낸다.
						//닉네임,메시지,말풍선 스킨
						oRoom[rname].userList[i].queue.emit('receive','chat',oUser[ID].nickname,msg,oUser[ID].balloonskin);
					}
					else
					{
						oRoom[rname].userList[i].queue.emit('receive','answer',oUser[ID].nickname,first==true?1:0,oUser[ID].balloonskin);
					}
				}
			}
			else
			{
				io.sockets.in(oUser[ID].place).emit('receive','chat',oUser[ID].nickname,msg,oUser[ID].balloonskin);
			}
		}
	}
}

//개인 채팅방에서 채팅을 하는 함수
function userRoomChat2(ID,msg,cname)
{
	//메시지의 tag를 모두 지우고, \n을 <br>로 바꾼다.
	msg=strip_tags(msg);
	msg=msg.replace(/\n/g, "<br>"); 
	
	if(msg.length > 0)
	{
		msg=replaceIcon(ID,msg);
		//유저가 소속되어 있는 채팅방인지에 대한 확인이 끝난 경우 해당 유저가 속해 있는 방에 채팅2로 메시지를 보낸다.
		if(oUser[ID].chatList.includes(cname) && typeof(oChat[cname]) != "undefined" && oChat[cname].members.includes(oUser[ID]))
		{
			var str="";
			for(var i=0;i<oChat[cname].members.length;i++)
			{
				str+=oChat[cname].members[i].nickname;
				if(i!=oChat[cname].members.length-1)str+="|";
			}
			io.sockets.in(cname).emit('receive','chat2',oUser[ID].nickname,msg,cname,str,oUser[ID].balloonskin);
			//즉석 퀴즈가 출제된 상태라면, 정답 여부를 확인한다.
			if(oChat[cname].instantQuiz != null)
			{
				if(msg.toLowerCase() == oChat[cname].instantQuiz.answer.toLowerCase())
				{
					io.sockets.in(cname).emit('receive','chatAnswer',oUser[ID].nickname,oChat[cname].instantQuiz.answer,cname,oUser[ID].balloonskin);
					//퀴즈를 초기화 해준다.
					oChat[cname].instantQuiz = null;
				}
			}
		}
	}
}

function replaceIcon(ID,msg)
{
	//유저가 보낸 icon을 보유하고 있는지 확인한 후에 바꿔야 한다.
	var matched = msg.match(/\[i(\d+)\]/g);
	var w,h;
	//[i(숫자)] 이므로, i로 split 하고, (숫자)] 가 [1]에 들어오므로 [1]을 ]로 split 한 결과가 최종이 될 것이다.
	//2015-07-21 배열의 크기가 1이고, 전체 string과 내용이 같다면 이미지를 크게 출력한다.
	if(matched != null && matched.length == 1 && matched[0]==msg)
		w=h=64;
	else
		w=h=24;
	if(matched != null)
	{
		for(var i=0;i<matched.length;i++)
		{
			if(i>10)break;
			var tmp = matched[i].split('i');
			var no = tmp[1].split(']');
			no = no[0]*1;

			//해당 숫자가 iconList에 있는지 확인한다.
			if(oUser[ID].iconskin.includes(no))
				msg = msg.replace(matched[i],'<img src="//hae.so/quitalk/images/iconskins/'+no+'.png" style="width:'+w+'px;height:'+h+'px;"/>');
		}
	}
	return msg;
}

//게임 시작 후 유저가 더 이상 들어올 수 없는 시간이 되었을 때, 유저가 얻게될 예상 점수를 설정하는 함수이다.
function setUserLadderScore(rname)
{
	if(oRoom[rname].currentUser == 1)
	{
		oRoom[rname].userList[0].queue.emit('receive','globalChat','혼자 플레이 하실 경우 점수 변동이 없습니다.',"chatting_view");
		oRoom[rname].isFriendShip = true;
	}
	//기준점이 될 Ladder 점수를 설정한다.
	var ladder=2*oRoom[rname].currentUser;

	//Ladder점수를 기준으로 배열을 정렬한다.
	oRoom[rname].userList.sort(function(a,b){return a.rate-b.rate;});

	//점수 산정방식은 다음과 같다.
	//인원수가 홀수일 경우 한가운데 있는 유저를 ladder,-ladder로 설정한다. 그리고 위로 올라갈 때는 -1,-1
	//아래로 내려갈 때는 +1,+1을 한다.
	//인원수가 짝수일 때는 인원수/2-1의 인원을 ladder,-ladder로 설정하여 시작한다.
	var pos=(oRoom[rname].currentUser%2==0)?oRoom[rname].currentUser/2-1:Math.floor(oRoom[rname].currentUser/2);
	oRoom[rname].userList[pos].winRate=ladder;
	oRoom[rname].userList[pos].loseRate=-ladder;
	var sno=1;
	
	for(var i=pos-1;i>=0;i--)
	{
		//바로 이전 유저와 점수가 똑같다면 sno를 빼지 않는다.
		oRoom[rname].userList[i].winRate=ladder;
		oRoom[rname].userList[i].loseRate=-ladder;
		if(oRoom[rname].userList[i].rate!=oRoom[rname].userList[i+1].rate)
		{
			oRoom[rname].userList[i].winRate+=sno;
			oRoom[rname].userList[i].loseRate+=sno;
		}
		sno++;
	}
	sno=1;
	for(var i=pos+1;i<oRoom[rname].currentUser;i++)
	{
		oRoom[rname].userList[i].winRate=ladder;
		oRoom[rname].userList[i].loseRate=-ladder;
		if(oRoom[rname].userList[i].rate!=oRoom[rname].userList[i-1].rate)
		{
			oRoom[rname].userList[i].winRate-=sno;
			oRoom[rname].userList[i].loseRate-=sno;
		}
		sno++;
	}
	//2015-07-26 친선전일때는 예상점수의 출력은 하지 않는다.
	if(!oRoom[rname].isFriendShip)
	{
		for(var i=0;i<oRoom[rname].currentUser;i++)
		{
			oRoom[rname].userList[i].queue.emit('receive','predictLadder',oRoom[rname].userList[i].winRate,oRoom[rname].userList[i].loseRate);
		}
	}
}

///////////////////////////////////////////////////////////////////////////////////////
///////////////////////여기부터는 퀴즈 출제와 관련된 function이다.//////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

//퀴즈를 처음 시작할 때, 방의 세팅 및 문제 trigger를 발동시키는 함수이다.
function startQuizRotation(rname)
{
	if(typeof(oRoom[rname]) != "undefined")
	{
		//퀴즈 푸는시간 15초, 정답발표 및 쉬는시간 10초 = 25초
		//15문제가 1세트이므로 25*15=325초(6분 25초)가 한 퀴즈이다.

		//문제를 진행시킨다.
		oRoom[rname].isPlayedQuiz=true;

		//만약 유저가 게임 도중 나가 최소인원수에 도달하지 못한다면 게임을 강제로 종료한다.
		if(!oRoom[rname].isStarted)
		{
			oRoom[rname].isPlayedQuiz=false;
			oRoom[rname].isFinished=false;
			io.sockets.in(rname).emit('receive','brokenQuiz');
		}
		else
		{
			oRoom[rname].quizCount++;
			if(oRoom[rname].quizCount>Config.quizCount)
			{
				finishQuiz(rname);
			}
			else
			{
					//문제를 출력한다.
				printQuiz(rname);
					//첫번째 힌트 공개는 5초후 공개한다.
				setTimeout(function(){makeHint(rname,1);},5000);
					//두번째 힌트 공개는 10초후 공개한다.
				setTimeout(function(){makeHint(rname,2);},10000);
					//정답 공개는 15초. 정답 공개와 동시에 순위를 보여준다. 다음 문제를 만든다.
				setTimeout(function()
				{
					if(typeof(oRoom[rname]) != "undefined")
					{
						printResult(rname,oRoom[rname].quizObject.answer);
						makeQuiz(rname);
					}
				},15000);

				//20초 뒤에 미리보기 아이템을 사용한 유저들에게 문제를 먼저 보내준다.
				if(oRoom[rname].quizCount != Config.bannerCount)
				{
					setTimeout(function()
					{
						if(typeof(oRoom[rname]) != "undefined")
						{
							sendQuestionEarly(rname);
						}
					},20000);
					setTimeout(function(){startQuizRotation(rname);},25000);
				}
				else
				{
					setTimeout(function()
					{
						if(typeof(oRoom[rname]) != "undefined")
						{
							sendQuestionEarly(rname);
						}
					},30000);
					setTimeout(function(){startQuizRotation(rname);},35000);
				}
			}
		}
	}
}

function makeQuiz(rname)
{
	var cQuiz = setTimeout(function(){new Quiz(rname);},0);
}

function printQuiz(rname)
{
	//퀴즈가 출제된 시간의 판정은 조금 느슨하게 잡는다. 문제를 먼저 보내주고, 그 뒤에 출제시간을 설정한다.
	if(typeof(oRoom[rname]) != "undefined")
	{
		//2015-07-18 대부분의 퀴즈는 문제 - 정답을 출제해주면 된다. 단, 9번타입(지하철) 등의 특정 타입은
		//문제 string을 직접 만들어 주어야 한다.
		
		io.sockets.in(rname).emit('receive','sendQuiz',oRoom[rname].quizObject.type,oRoom[rname].quizObject.category,oRoom[rname].quizObject.question,oRoom[rname].quizCount);
		if(typeof(oRoom[rname].quizObject) !="undefined")
			oRoom[rname].quizObject.questionTime = new Date().valueOf();
	}
	//글자수 아이템을 사용하고 있는 유저에게는 글자의 length를 별도로 전송한다.
	//2015-07-08 : 글자의 length에서 공백은 제거 하고 알려준다.
	var anslen = oRoom[rname].quizObject.answer.replace(/\s/g, '').length;
	for(var i = 0; i< oRoom[rname].userList.length; i++)
	{
		if(oRoom[rname].userList[i].usedItem == Item.ANSWER_LENGTH)
		{
			oRoom[rname].userList[i].usedItem = Item.NOT_USED;
			oRoom[rname].userList[i].queue.emit('receive','answerLength',anslen);
		}
		else if(oRoom[rname].userList[i].usedItem == Item.FEELING_LUCKY)
			oRoom[rname].userList[i].feelingLucky = true;
	}
}

function printInstantQuiz(cname)
{
	//인스턴트 퀴즈는 힌트가 제공되지 않는다.
	if(typeof(oChat[cname]) != "undefined")
	{
		var str="";
		for(var i=0;i<oChat[cname].members.length;i++)
		{
			str+=oChat[cname].members[i].nickname;
			if(i!=oChat[cname].members.length-1)str+="|";
		}
		io.sockets.in(cname).emit('receive','sendInstantQuiz',oChat[cname].instantQuiz.type,oChat[cname].instantQuiz.category,oChat[cname].instantQuiz.question,cname,str);
	}
}

/*
String[] getHintArray(String answer)
퀴톡의 힌트 제작 방식은 다음과 같다.
1. 0,1,2는 힌트가 보여질 때를 결정한다. 0은 공개되지 않는 글자이다.
2. 최종적으로 가려지는 글자 수는 ~3글자:1개, ~7글자:2개,7글자~:3개 이다.
3. 1글자를 제외하고 나머지는 절반으로 나눠서 하되, 나중에 공개되는 글자가 더 많다.
*/
function getHintArray(answer)
{
	var hintArr = [0];
	//7글자부터는 최대 미공개 글자를 2개로 만든다.
	if(answer.length>6)hintArr.push(0);
	var len = Math.floor(answer.length/2);
	for(var i=0;i<len;i++)
	{
		hintArr.push(1,2);
	}
	//초과된 배열은 길이에 맞게 splice 해준다.
	hintArr.splice(answer.length,2);

	//배열 shuffle
	hintArr=shuffle(hintArr);

	return hintArr;
}

/*
String[] makeHint(String rname,int cnt)
cnt는 공개될 힌트의 number이다. cQui
*/
function makeHint(rname,cnt)
{
	if(typeof(oRoom[rname])=='undefined') return;
	var hint="";
	for(var i=0;i<oRoom[rname].quizObject.answer.length;i++)
	{
		//2015-07-07 : 공백dl *표처리되면 혼란을 줄 수 있으므로 배열에 상관없이 무조건 공개해 버린다.
		if(oRoom[rname].quizObject.answer[i]==' ')hint+=' ';
		else if(oRoom[rname].quizObject.hintArray[i]==0)hint+='*';
		else if(oRoom[rname].quizObject.hintArray[i]<=cnt)hint+=oRoom[rname].quizObject.answer[i];
		else hint+="*";
	}
	//힌트를 모두에게 날린다.
	io.sockets.in(rname).emit('receive','sendHint',cnt,hint);
}

// void printResult(String rname, String answer)
//결과를 출력하고 랭킹을 반영하며 점수를 저장하는 부분을 담당한다.
function printResult(rname,answer)
{
	//room에 있는 userLIst 배열을 문제를 제출한 순서대로 설정한다.
	//단, 오답자는 무조건 순위에서 제외되며, 1등부터 4,3,2점을 부여후 나머지는 모두 1점이다.
	if(typeof(oRoom[rname]) != "undefined")
	{
		oRoom[rname].isPlayedQuiz=false;
		oRoom[rname].userList.sort(function(a,b){return a.answerTime-b.answerTime;});
		var ac=0,last=0,rank=1,add=4,str="<span style='font-size:11px;'>정답은 ["+answer+"] 입니다.<br>맞춘 순위<br>";

		for(var i=0;i<oRoom[rname].userList.length;i++)
		{
			//먼저 정답이 맞는지 확인한다.
			if(!checkAnswer(oRoom[rname].userList[i],answer))
			{
				//복불복 아이템을 사용중일 경우 score에 -를 하고, 개별 통보를 한다.
				if(oRoom[rname].userList[i].feelingLucky == true)
				{
					oRoom[rname].userList[i].score -= 3;
					io.sockets.in(rname).emit('receive','globalChat',oRoom[rname].userList[i].nickname+ '님의 복불복 실패! -3점 되었습니다 ㅠ.ㅠ',"chatting_view");
				}
				oRoom[rname].userList[i].answer="";
				continue;
			}
			if(oRoom[rname].userList[i].feelingLucky == true)
			{
				oRoom[rname].userList[i].score += 4;
				io.sockets.in(rname).emit('receive','globalChat',oRoom[rname].userList[i].nickname+ '님의 복불복 성공! <span style="color:red;">+4점</span> 되었습니다!!!',"chatting_view");
			}
			oRoom[rname].userList[i].answer="";
			//점수를 더해준다.
			ac++;
			last=i;
			oRoom[rname].userList[i].score+=add+oRoom[rname].stackScore;
			
			str+=rank+"위 : "+oRoom[rname].userList[i].nickname+"(+"+(add+oRoom[rname].stackScore)+") ";
			if((i+1)%2==0) str+="<br>";
			oRoom[rname].stackScore=0;
			rank++;
			add--;
			if(add==0)add=1;
		}
		//맞춘사람이 아무도 없을 경우 점수를 누적시킨다.
		if(ac==0)
		{
			oRoom[rname].stackScore++;
			str+="이런! 맞춘 사람이 아무도 없군요. <br>다음 문제 1등에게는 보너스 점수"+oRoom[rname].stackScore+" 점이 추가됩니다!";
		}
		//혼자 맞췄을 경우 보너스 점수 2점을 추가한다.
		else if(ac==1)
		{
			oRoom[rname].stackScore=0;
			str+="<br><b style='font-size:15px;'>독식!</b> 보너스 점수 <b>2점</b>을 드립니다.";
			oRoom[rname].userList[last].score+=2;

			//폭식을 사용했을 경우 보너스 점수 2점을 더 추가한다.
			if(oRoom[rname].userList[last].usedItem == Item.OVEREAT)
			{
				str+="<br><b style='font-size:15px; color:red'>폭식!!</b> 아이템 점수 <b>2점</b>을 더 드립니다.";
				oRoom[rname].userList[last].score+=2;
				//아이템 사용 정보를 초기화한다.
				oRoom[rname].userList[last].usedItem = Item.NOT_USED;
			}
		}
		else oRoom[rname].stackScore=0;
		//우선 맞춘순위를 보낸다. 그 후 전체 순위를 종합하여 다시 보낸다.
		str+="</span>";
		io.sockets.in(rname).emit('receive','globalChat',str,"chatting_view");
		
		//이번엔 score를 기준으로 sort한다.
		oRoom[rname].userList.sort(function(a,b){return b.score-a.score;});
		rank=1,stack=1,str="<span style='font-size:11px;'>전체 순위입니다.<br>1위 : "+oRoom[rname].userList[0].nickname+"("+oRoom[rname].userList[0].score+")";
		for(var i=0;i<oRoom[rname].userList.length;i++)
		{
			//아이템 사용기회가 지난 유저의 아이템을 초기화 해준다.
			//2015-08-10 복불복은 사용이 된 후에 삭제한다.
			if(oRoom[rname].userList[i].usedItem == Item.OVEREAT || oRoom[rname].userList[i].usedItem == Item.CHEATING || (oRoom[rname].userList[i].usedItem == Item.FEELING_LUCKY && oRoom[rname].userList[i].feelingLucky == true))	
			{
				oRoom[rname].userList[i].feelingLucky = false;
				oRoom[rname].userList[i].usedItem = Item.NOT_USED;
			}
			if(i==0)continue;
			if(oRoom[rname].userList[i].score==oRoom[rname].userList[i-1].score)stack++;
			else rank+=stack,stack=1;
			str+=rank+"위 : "+oRoom[rname].userList[i].nickname+"("+oRoom[rname].userList[i].score+") ";
			if((i+1)%2==0) str+="<br>";
		}
		//8문제를 푼 뒤에는 쉬는 시간 10초를 늘린 후, 광고를 송출한다.
		if(oRoom[rname].quizCount == Config.bannerCount)
			str+="<br> 20초 후 다음 문제가 출제됩니다.</span>";
		else if(oRoom[rname].quizCount<Config.quizCount)
			str+="<br> 10초 후 다음 문제가 출제됩니다.</span>";
		else
			str+="<br> 10초 후 최종 결과가 발표됩니다.</span>";
		io.sockets.in(rname).emit('receive','globalChat',str,"chatting_view");
		if(oRoom[rname].quizCount == Config.bannerCount)
			io.sockets.in(rname).emit('receive','banner',"chatting_view",oRoom[rname].advertise);
	}
}

//유저가 입력한 정답을 확인하는 함수이다. 마법의 펜 아이템을 사용중인 경우
//한글자는 .인 경우에 통과를 시킬 수 있다.
function checkAnswer(pUser, answer)
{
	//2015-07-08 띄어쓰기는 정답 체크에 영향을 주지 않는다.
	var panswer = pUser.answer.toLowerCase().replace(/\s/g, '');
	answer = answer.toLowerCase().replace(/\s/g, '');
	if(pUser.usedItem != Item.MAGIC_PEN)
	{
		return panswer==answer;
	}
	//마법의 펜을 사용중인 경우 한글자씩 검사를 한다.
	//한글자를 .로 처리한 경우에만 continue이며, 그냥 틀린 경우에는 인정이 되지 않는다.
	
	//유저의 매직 팬 사용을 초기화 해준다.
	pUser.usedItem = Item.NOT_USED;

	//글자수가 다르다면 검사할 필요도 없이 잘못된 값이다.
	if(panswer.length != answer.length)
		return false;

	var len = Math.min(panswer.length, answer.length);
	var pass = false;
	for(var i=0; i<len; i++)
	{
		if(panswer.charAt(i) != answer.charAt(i))
		{
			if(panswer.charAt(i) != "." || pass == true)
				return false;
			//마법의 펜 사용 성공이므로 통과 시킨다.
			pass = true;
		}
	}
	return true;
}

function finishQuiz(rname)
{
	if(typeof(oRoom[rname]) != "undefined")
	{
		//승패의 기준은 다음과 같다.
		//1위부터 정렬을 한뒤, 동점자는 같은 등수에 포함시켜 쭉 모은다.
		//그 모인 그룹이 전체의 절반이 안넘을 때까지 모아 그 집단은 +를 시킨다.
		var avg=Math.floor(oRoom[rname].currentUser/2);
		var cur=0,t=0,p=0,len=oRoom[rname].userList.length;
		
		//등수를 재정렬한다.
		oRoom[rname].userList.sort(function(a,b){return b.score-a.score;});
		while(t<len)
		{
			cur=t;
			p=0;
			while(t<len && oRoom[rname].userList[cur].score == oRoom[rname].userList[t].score)
			{
				p++;
				if(t<len) t++;
				else break;
			}
			//cur+p가 avg에 걸칠 경우에는 +가 되며, 아닐 경우에는 while문을 끝낸다.
			if(cur+p>avg) break;
		}
		
		var str="<span style='font-size:11px;'>퀴즈가 종료되었습니다.<br>최종 순위<br>";
		//cur까지가 승자이며, 이후로는 패자로 처리되어 점수를 감점시킨다.
		for(var i=0;i<cur;i++)
		{
			str+=(i+1)+"위 : "+oRoom[rname].userList[i].nickname+" 님 ";
			if(!oRoom[rname].isFriendShip)
				str+="(+"+oRoom[rname].userList[i].winRate+"점/"+oRoom[rname].userList[i].score+"포인트) ";
			if((i+1)%2==0) str+="<br>";
			if(!oRoom[rname].isFriendShip && !oRoom[rname].userList[i].isGuest)
			{
				var sql="update quitalk_member set rate=rate+"+pool.escape(oRoom[rname].userList[i].winRate)+" where email="+pool.escape(oRoom[rname].userList[i].ID);
				oRoom[rname].userList[i].rate += oRoom[rname].userList[i].winRate;
				pool.query(sql);
				//2015-07-12 얻은 점수만큼 point로 지급한다.
				sql = "update quitalk_member set points=points+"+pool.escape(oRoom[rname].userList[i].score)+" where email="+pool.escape(oRoom[rname].userList[i].ID);
				pool.query(sql);
			}
			else if(oRoom[rname].currentUser == 1)	//2015-08-13 혼자 풀경우 혼자하기 포인트+5점 지급
			{
				var sql = "update quitalk_member set points=points+20 where email="+pool.escape(oRoom[rname].userList[i].ID);
				oRoom[rname].userList[i].queue.emit('receive','globalChat',"혼자하기 보상으로 20포인트가 지급되었습니다.","chatting_view");
				pool.query(sql);
			}
		}
		for(var i=cur;i<len;i++)
		{
			str+=(i+1)+"위 : "+oRoom[rname].userList[i].nickname+" 님 ";
			if(!oRoom[rname].isFriendShip)
				str+="("+oRoom[rname].userList[i].loseRate+"점/"+oRoom[rname].userList[i].score+"포인트) ";
			if((i+1)%2==0) str+="<br>";
			if(!oRoom[rname].isFriendShip && !oRoom[rname].userList[i].isGuest)
			{
				var sql="update quitalk_member set rate=rate+"+pool.escape(oRoom[rname].userList[i].loseRate)+" where email="+pool.escape(oRoom[rname].userList[i].ID);
				oRoom[rname].userList[i].rate += oRoom[rname].userList[i].loseRate;
				pool.query(sql);
				sql = "update quitalk_member set points=points+"+pool.escape(oRoom[rname].userList[i].score)+" where email="+pool.escape(oRoom[rname].userList[i].ID);
				pool.query(sql);
			}
			else if(oRoom[rname].currentUser == 1 && oRoom[rname].userList[i].score>19)	//2015-08-13 혼자 풀경우 혼자하기 포인트+5점 지급
			{
				var sql = "update quitalk_member set points=points+20 where email="+pool.escape(oRoom[rname].userList[i].ID);
				oRoom[rname].userList[i].queue.emit('receive','globalChat',"혼자하기 보상으로 20포인트가 지급되었습니다.","chatting_view");
				pool.query(sql);
			}
		}
		str+="<br>수고하셨습니다. 새로운 게임을 하시려면 퇴장하시면 됩니다.</span>";
		oRoom[rname].isPlayedQuiz=false;
		io.sockets.in(rname).emit('receive','globalChat',str,"chatting_view");
		//2015-08-03 광고는 방에서 1개씩 update를 하여 노출 교환 텀을 조금 늘린다.
		pool.query("update quitalk_config set bannerCount=IF(bannerCount=totalBannerCount,1,bannerCount+1)");
	}
}

/////////////////////////////퀴톡 아이템과 관련된 함수/////////////////////////////////////

//사용할 아이템에 대한 유효성을 검사한다. 이미 2번을 사용하였거나, 다른 아이템 사용 대기중일 경우에는 제외한다.
//아이템은 다음 문제 사용, 이번 문제 사용으로 나뉘어 있으며, 정답 공개 이후 초기화 되는 아이템의 초기화는
//printResult() 에서 진행한다.
function useItem(client, ID, msg)
{
	//게임 카운트가 시작된 순간부터 사용할 수 있다.
	if(oUser[ID].place != -1 && oRoom[oUser[ID].place].countStarted == true)
	{
		if(oUser[ID].useItemCount==3)
			client.emit('receive','globalChat','아이템은 한 게임에 3번만 이용하실 수 있습니다.',"chatting_view");
		else if(oUser[ID].usedItem != Item.NOT_USED)
			client.emit('receive','globalChat','이미 다른 아이템 사용 대기중입니다.',"chatting_view");
		else
		{
			var itemno = msg;
			switch(itemno)
			{
				case 1:		//미리보기
					if(oRoom[oUser[ID].place].quizCount<1)
						client.emit('receive','globalChat','첫번째 문제에서는 미리보기를 사용하실 수 없습니다.',"chatting_view");
					else
					{
						//미리보기 아이템을 세팅해 놓는다.
						oUser[ID].useItemCount++;
						oUser[ID].usedItem = Item.PREVIEW_QUESTION;
						client.emit('receive','globalChat','이제 다음 문제를 5초 먼저 볼 수 있습니다.',"chatting_view");
					}
				break;
				case 2:		//폭식
					oUser[ID].useItemCount++;
					oUser[ID].usedItem = Item.OVEREAT;
					client.emit('receive','globalChat','정답 공개전까지 독식을 하면 폭식!',"chatting_view");
				break;
				case 3:		//몇글자야?
					oUser[ID].useItemCount++;
					oUser[ID].usedItem = Item.ANSWER_LENGTH;
					client.emit('receive','globalChat','다음 문제의 글자 수를 바로 알려드립니다.',"chatting_view");
				break;
				case 4:		//복불복
					oUser[ID].useItemCount++;
					oUser[ID].usedItem = Item.FEELING_LUCKY;
					client.emit('receive','globalChat','다음 문제를 맞출 경우 +4점, 실패시 -3점 됩니다.',"chatting_view");
				break;
				case 5:		//컨닝
					oUser[ID].useItemCount++;
					oUser[ID].usedItem = Item.CHEATING;
					client.emit('receive','globalChat','이제 정답 공개 전까지 다른 사람들의 정답이 보입니다.',"chatting_view");
				break;
				case 6:		//마법의 펜
					oUser[ID].useItemCount++;
					oUser[ID].usedItem = Item.MAGIC_PEN;
					client.emit('receive','globalChat','정답을 내실 때 모르는 1글자를 "."로 입력하세요.<br>(ex : 답이 사과면, 사. 또는 .과)',"chatting_view");
				break;
				default:
					io.sockets.in(rname).emit('receive','globalChat',"[경고]존재하지 않는 아이템을 보내지 마세요.","chatting_view");
				break;
			}
		}
	}
}

function sendQuestionEarly(rname)
{
	for(var i in oRoom[rname].userList)
	{
		var oid=oRoom[rname].userList[i];
		if(oid.usedItem == Item.PREVIEW_QUESTION)
		{
			//해당 유저에게 문제를 보내고, 5초뒤에 문제가 다시 나오면 그 때 정답을 입력해야 된다고 알려준다.
			oid.queue.emit('receive','sendQuiz',oRoom[rname].quizObject.type,oRoom[rname].quizObject.category,oRoom[rname].quizObject.question,oRoom[rname].quizCount);
			oid.queue.emit('receive','globalChat',"미리보기 아이템을 사용한 사람만 보이는 퀴즈입니다.<br><span style='color:red;'>5초 뒤에 문제가 다시 나오면</span>, 그 때 정답을 입력하세요!","chatting_view");
			
			//해당 유저의 item 사용 기록을 정리한다.
			oid.usedItem = Item.NOT_USED;
		}
	}
}
function addFriendRequest(client,ID,fnick)
{
	if(!oUser[ID].isGuest)
	{
		//자기 자신에게 친구신청을 할 수는 없다.
		if(fnick == oUser[ID].nickname)
			client.emit('receive','alertError',"자기 자신에게 신청할 수 없습니다.");
		else if(fnick == "관리자" ||fnick == "운영자" || fnick=="테스트" || fnick=="퀴톡")
			client.emit('receive','alertError',"친구신청을 할 수 없는 대상입니다.");
		else
		{
			//차단된 경우에는 다시 친구신청을 걸 수 없다.
			var sql="select * from quitalk_friend_block where (qto="+pool.escape(fnick)+" and qfrom="+pool.escape(oUser[ID].nickname)+") or (qfrom="+pool.escape(fnick)+" and qto="+pool.escape(oUser[ID].nickname)+")";
			pool.query(sql,function(err,rows,fields)
			{
				if(rows.length>0)
					client.emit('receive','alertError',"상대방 또는 나의 차단 목록에 포함되어 있는 상대입니다.");
				else
				{
					//먼저 친구목록에 이미 있는 사람인 경우 무시한다.
					var sql="select * from quitalk_friend where (friend1nick = "+pool.escape(fnick)+" and friend2nick = "+pool.escape(oUser[ID].nickname)+") or (friend2nick = "+pool.escape(fnick)+" and friend1nick = "+pool.escape(oUser[ID].nickname)+")";
					pool.query(sql,function(err,rows,fields)
					{
						if(rows.length > 0)
							client.emit('receive','alertError',"이미 친구목록에 있는 유저입니다.");
						else
						{
							//실제로 존재하는 유저인지에 대해 체크한다.
							var sql="select * from quitalk_member where nickname="+pool.escape(fnick);
							pool.query(sql,function(err,rows,fields)
							{
								if(rows.length == 0)
									client.emit('receive','alertError',"존재하지 않는 유저입니다.");
								else
								{
									var fid = rows[0].email;
									//이미 친구신청을 보냈는지 체크한다.
									var sql="select * from quitalk_friend_request where qto="+pool.escape(fnick)+" and qfrom="+pool.escape(oUser[ID].nickname);
									pool.query(sql,function(err,rows,fields)
									{
										if(rows.length > 0)
											client.emit('receive','alertError',"이미 친구 요청을 보냈습니다.");
										else
										{
											//친구 request에 데이터를 삽입한다.
											var sql = "insert quitalk_friend_request(qto,qfrom) values("+pool.escape(fnick)+","+pool.escape(oUser[ID].nickname)+")";
											pool.query(sql,function(err,rows,fields)
											{
												if(!err)
													client.emit('receive','alertError',"친구 요청이 완료되었습니다.");
												if(typeof(oUser[fid]) != "undefined")
													oUser[fid].queue.emit('receive','waitFriendRequest',1);
											});
										}
									});
								}	
							});
						}
					});
				}
			});
		}
	}
}
function getFriendList(client,ID)
{
	//2015-08-23 비회원은 메뉴 활성화 제한
	if(oUser[ID].isGuest)
		client.emit('receive','globalChat',"로그인 후 이용가능한 메뉴입니다.","chatting_view");
	else
	{
		//로비에서만 실행 가능하다.
		if(oUser[ID].place == -1)
		{
			//친구신청에 대한 검색을 먼저 시작한다.
			var sql = "select * from quitalk_friend_request where qto="+pool.escape(oUser[ID].nickname);
			pool.query(sql,function(err,rows,field)
			{
				if(rows.length>0)
				{
					var str="";
					//length 만큼 for문을 돌려 목록 리스트를 만든다.
					for(var i=0;i<rows.length;i++)
					{
						var qfrom = rows[i].qfrom;
						str+=qfrom;
						if(i!=rows.length-1)str+="|";
					}
				}
				client.emit('receive','friendRequestList',str);
				//friend table의 friend1 또는 friend2에 자신의 nickname이 적혀 있는 경우를 찾는다.
				var sql="select * from quitalk_friend where friend1nick='"+oUser[ID].nickname+"' or friend2nick='"+oUser[ID].nickname+"';";
				pool.query(sql,function(err,rows,fields)
				{
					var cnt=rows.length;
					var str="";

					for(var i=0;i<cnt;i++)
					{
						var f1=rows[i].friend1nick,f2=rows[i].friend2nick,myNick=oUser[ID].nickname;
						
						f1==myNick ? str+=f2 : str+=f1;
						var chk=rows[i].friend1==ID?rows[i].friend2:rows[i].friend1;

						if(typeof(oUser[chk])=="undefined")str+=",0";	//접속중이 아님.
						else if(oUser[chk].place != -1)str+=",2";		//게임중.
						else str+=",1";//대기중

						if(i<cnt-1)str+="|";
					}
					var cname="";
					client.emit('receive','friendList',str);
				});});}}
}

function getInviteFriendList(client,ID,cname)
{
	if(!oUser[ID].isGuest)
	{
		//friend table의 friend1 또는 friend2에 자신의 nickname이 적혀 있는 경우를 찾는다.
		var sql="select * from quitalk_friend where friend1nick='"+oUser[ID].nickname+"' or friend2nick='"+oUser[ID].nickname+"';";
		pool.query(sql,function(err,rows,fields)
		{
			var cnt=rows.length;
			var str="";

			for(var i=0;i<cnt;i++)
			{
				var f1=rows[i].friend1nick,f2=rows[i].friend2nick,myNick=oUser[ID].nickname;
				var chkNick = f1==myNick ? f2:f1;
				var f=true;
				
				for(var j=0;j<oChat[cname].members.length;j++)
					if(oChat[cname].members[j].nickname == chkNick)
					{
						f=false;
						break;
					}
				if(!f)continue;
				f1==myNick ? str+=f2 : str+=f1;
				var chk=rows[i].friend1==ID?rows[i].friend2:rows[i].friend1;

				if(typeof(oUser[chk])=="undefined")str+=",0";	//접속중이 아님.
				else if(oUser[chk].place != -1)str+=",2";		//게임중.
				else str+=",1";//대기중
				if(i<cnt-1)str+="|";
			}
			client.emit('receive','inviteFriendList',str,cname);
		});
	}
}

function acceptFriendRequest(client,ID,fnick)
{
	if(!oUser[ID].isGuest)
	{
		//request에 요청이 있는지 확인한다.
		var sql = "select * from quitalk_friend_request where qfrom = "+pool.escape(fnick)+" and qto = "+pool.escape(oUser[ID].nickname);
		pool.query(sql,function(err,rows,fields)
		{
			if(!err && rows.length>0)
			{
				var fnick1=rows[0].qto;
				var fnick2=rows[0].qfrom;
				if(rows.length > 0)
				{
					//nickname을 통해 ID와 value를 얻는다.
					var sql = "select * from quitalk_member where nickname = "+pool.escape(fnick1)+" or nickname="+pool.escape(fnick2);
					pool.query(sql,function(err,rows,fields)
					{
						//fid1은 fnick1과, fid2는 fnick2와 매칭시킨다.
						var fid1=fnick1==rows[0].nickname?rows[0].email:rows[1].email;
						var fid2=fnick2==rows[1].nickname?rows[1].email:rows[0].email;

						var sql = "insert quitalk_friend(friend1,friend2,friend1nick,friend2nick) values("+pool.escape(fid1)+","+pool.escape(fid2)+","+pool.escape(fnick1)+","+pool.escape(fnick2)+")";
						pool.query(sql,function(err,row,fields)
						{
							//client에게 친구목록을 다시 보내도록 한다.
							if(!err)
							{
								//request를 삭제한다.
								var sql = "delete from quitalk_friend_request where qto="+pool.escape(fnick1)+" and qfrom = "+pool.escape(fnick2);
								pool.query(sql);
								client.emit('receive','refreshFriendList');
							}});});}}
			else client.emit('receive','alertError',"친구신청이 취소되었거나 일시적인 오류입니다.\n친구목록을 다시 불러와주세요.");
		});
	}
}

//real의 chatList에 방이 이미 있는지 검사한다.
function isAlreadyExistsRoom(real, to, from)
{
	var arr = [];
	//2015-07-26 to의 type이 string일 경우와 object(배열)일 경우를 나눈다.
	if(typeof(to) == "string")
		arr = [to, from].sort();
	else if(typeof(to) == "object")
	{
		arr = to.slice();
		arr.push(from);
		arr.sort();
	}
	else
		real.queue.emit('receive','alertError',"유효하지 않은 시도입니다.");
	for(var i=0;i<real.chatList.length;i++)
	{
		var cname = real.chatList[i];
		if(typeof(oChat[cname])=='undefined' || oChat[cname].members.length != arr.length) continue;
		//채팅방에 대한 정보 및 임시 배열을 만든다.
		
		var tmparr = [];
		for(var j=0;j<oChat[cname].members.length;j++)
			tmparr.push(oChat[cname].members[j].nickname);
		//sort 후 같은지 비교한다.
		tmparr = tmparr.sort();
		if(arr.join()==tmparr.join())
		{
			real.queue.emit('receive','alreadyExistChat',cname);
			return true;
		}
	}
	return false;
}

//개인 채팅방을 만드는 함수이다. 정확히 본인인지, 친구와 개설을 하는 것이 맞는지, 이미 개설된 방이 있는지
//기타 문제에 대한 철저한 검사를 진행한다.
function makePrivateChat(real, to, from)
{
	//real : 실제 요청을 보낸 유저 정보, to : 요청을 받는이(string 또는 object), from : 요청을 보낸이
	//2015-07-26 단체방일 경우, 배열을 통해 하나하나 검사를 한다. 그러므로 to를 array화 시킨다.
	if(typeof(to)=="string")
	{
		var temp = to;
		to = [];
		to.push(temp);
	}
	var c=0,realto=[];
	//정보 일치에 대한 여부를 검사한다.
	if(real.nickname == from)
	{
		for(var i=0;i<to.length;i++)
		{
			//본인과 친구 관계인 경우에만 채팅을 보낼 수 있다.
			var sql="select * from quitalk_friend where (friend1nick="+pool.escape(to[i])+" and friend2nick="+pool.escape(from)+") or (friend2nick="+pool.escape(to[i])+" and friend1nick="+pool.escape(from)+")";
			pool.query(sql,function(err,row,fields)
			{
				if(row.length > 0)
				{
					//친구 관계가 성립되었으므로 방을 만든다.
					//개인채팅방의 id 형식은 두 닉네임을 사전순으로 정렬 후, md5를 하여
					//chat+timestamp를 한 결과를 저장하고, 그 id값은 알려주지 않는다.

					//친구가 로그인 중인지 확인한다.
					var fid = row[0].friend1 != real.ID ? row[0].friend1 : row[0].friend2;
					if(typeof(oUser[fid]) == "undefined")
						real.queue.emit('receive','alertError',"로그인 중인 대상이 아닌 대상이 있습니다.");
					else
					{
						c++;
						realto.push(oUser[fid]);
					}
					if(c==to.length)	//모든 인원이 들어올 수 있을 시
						cbMakePrivateChat(real, realto, from);
				}
				else
					real.queue.emit('receive','alertError',"유효하지 않은 대상이 추가되어 있습니다.");
			});
		}
	}
}

function cbMakePrivateChat(real, to, from)
{
	//2015-07-26 to는 array가 되어 있는 상태
	var cno=new Date().getTime();
	while(typeof(oChat['chat'+cno]) != "undefined")cno--;
	var cname='chat'+cno;
	//생성자에 최초로 개설을 요청한 사람의 정보를 넣고 시작한다.
	var temp=new Chat(oUser[real.ID]);
	oChat[cname] = temp;
	oChat[cname].count=to.length+1;

	//real(방장)에 대한 작업을 시작한다.
	oUser[real.ID].chatList.push(cname);
	oUser[real.ID].queue.join(cname);
	//요청자의 정보는 생성자에서 넣었으므로, 상대방을 추가로 넣어준다.

	for(var i=0;i<to.length;i++)
	{
		oChat[cname].members.push(to[i]);
		to[i].chatList.push(cname);
		to[i].queue.join(cname);
	}

	//real user에게 채팅방 생성을 알려주어 채팅창 element를 생성한다.
	//div id는 cname과 같다.
	var str="";
	for(var i=0;i<oChat[cname].members.length;i++)
	{
		str+=oChat[cname].members[i].nickname;
		if(i!=oChat[cname].members.length-1)str+="|";
	}
	//2015-07-26모든 유저에게 UI 생성, 요청한 자만 open 시키도록 설정.
	real.queue.emit('receive','completeMakePrivateChat',cname,real.nickname,str);
}

function invitePrivateChat(real, to, cname)
{
	var from = real.nickname;
	var c=0;
	for(var i=0;i<to.length;i++)
	{
		//본인과 친구 관계인 경우에만 채팅을 보낼 수 있다.
		var sql="select * from quitalk_friend where (friend1nick="+pool.escape(to[i])+" and friend2nick="+pool.escape(from)+") or (friend2nick="+pool.escape(to[i])+" and friend1nick="+pool.escape(from)+")";
		var str2=[];
		pool.query(sql,function(err,row,fields)
		{
			if(row.length > 0)
			{
				//친구 관계가 성립되었으므로 방을 만든다.
				//개인채팅방의 id 형식은 두 닉네임을 사전순으로 정렬 후, md5를 하여
				//chat+timestamp를 한 결과를 저장하고, 그 id값은 알려주지 않는다.

				//친구가 로그인 중인지 확인한다.
				var fid = row[0].friend1 != real.ID ? row[0].friend1 : row[0].friend2;
				if(typeof(oUser[fid]) != "undefined")
				{
					//친구의 oUser 정보를 push 하고, 인원을 증가시킨다.
					oChat[cname].members.push(oUser[fid]);
					oChat[cname].count++;
					oUser[fid].chatList.push(cname);
					oUser[fid].queue.join(cname);
					str2.push(oUser[fid].nickname);
				}
				c++;
				if(c==to.length)
				{
					var str="";
					for(var i=0;i<oChat[cname].members.length;i++)
					{
						str+=oChat[cname].members[i].nickname;
						if(i!=oChat[cname].members.length-1)str+="|";
					}
					io.sockets.in(cname).emit('receive','updateChatUI',cname,str);
					io.sockets.in(cname).emit('receive','globalChat',str2.join(",")+"("+str2.length+" 명)이 초대되었습니다.",cname);
				}
			}
			else
				real.queue.emit('receive','alertError',"유효하지 않은 대상이 추가되어 있습니다.");
		});
	}
}

function requestGroupPlay(ID,cname)
{
	if(!oUser[ID].isGuest)
	{
		//채팅방에 유효하게 존재하는 인원인지에 대한 검사를 진행한다.
		if(typeof(oChat[cname]) != "undefined" && oUser[ID].chatList.includes(cname) && oChat[cname].members.includes(oUser[ID]))
		{
			//2015-07-26 단체방의 인원수가 게임방의 최대제한을 넘어가는 경우에는 퀴즈방의 최대인원이 넘어가므로 접속을 제한한다.
			if(oChat[cname].count > Config.maxPlayingUser)
				oUser[ID].queue.emit('receive','globalChat',Config.maxPlayingUser+'이상의 단체방에서는 즉석퀴즈만 이용 가능합니다.',cname);
			//같이하기가 진행중인 경우에는 이미 진행중임을 알린다.
			if(oChat[cname].requestGroupPlay==true)
				oUser[ID].queue.emit('receive','globalChat','이미 같이하기 투표가 진행중입니다.',cname);
			else
			{
				oChat[cname].requestGroupPlay=true;
				//해당 채팅방 인원들 모두에게 메시지를 보낸다.
				var str="";
				for(var i=0;i<oChat[cname].members.length;i++)
				{
					str+=oChat[cname].members[i].nickname;
					if(i!=oChat[cname].members.length-1)str+="|";
				}
				io.sockets.in(cname).emit('receive','voteGroupPlay',cname,str);
				if(oChat[cname].count > 2)
					io.sockets.in(cname).emit('receive','globalChat','3명 이상의 같이하기는 점수가 오르지 않는 친선모드로 플레이됩니다.',cname);
			}
		}
	}
}

function agreeGroupPlay(ID,cname)
{
	if(!oUser[ID].isGuest)
	{
		//채팅방에 유효하게 존재하는 인원인지에 대한 검사를 진행한다.
		if(oUser[ID].chatList.includes(cname) && oChat[cname].members.includes(oUser[ID]))
		{
			//동의를 누른 유저가 이미 존재한다면 합산하지 않는다.
			if(oChat[cname].agree.includes(oUser[ID].nickname)) return;

			//동의 멤버에 포함 시키고, count를 증가시킨다.
			oChat[cname].agree.push(oUser[ID].nickname);
			oChat[cname].groupPlay++;

			//만약 count와 groupPlay의 수가 같아진다면 findRoom을 시작한다.
			//게임 시작의 화면 출력은 force mode이다. 방이 찾아질 경우 모든 방을 채팅 UI를 강제로 닫고, 게임 화면을 보여준다.
			if(oChat[cname].groupPlay == oChat[cname].count)
			{
				oChat[cname].agree = [];	//배열 초기화
				oChat[cname].groupPlay = 0;	//동의 수 초기화
				oChat[cname].requestGroupPlay = false;
				findRoomByGroup(cname);
			}
		}
	}
}

function getInstantQuiz(ID,cname)
{
	if(typeof(oChat[cname]) == "undefined") return;
	//인스턴트 퀴즈는 맞추거나, 못맞추었을 경우 1분 동안은 재출제가 불가능하다.
	if(oChat[cname].instantQuiz == null || curTime - oChat[cname].lastQuizTime > 60000)
	{
		//퀴즈를 만든다. 출제는 생성자에서 바로 한다.
		var curTime = new Date().getTime();
		var tQuiz = new InstantQuiz(cname);
		oChat[cname].lastQuizTime = curTime;
	}
	else
	{
		oUser[ID].queue.emit('receive','globalChat','새로운 퀴즈는 1분이 지나야 출제 가능합니다.',cname);
	}
}

//websocket, flashsocket, XHR-Polling ,jsonp-poling의 접속 방법을 적용한다.
http.listen(10086, function()
{
	this.transports = ['websocket', 'flashsocket', 'xhr-polling', 'jsonp-polling'];
	console.log('퀴톡 Server가 가동되었습니다.');
});


///////////////////////////////etc Function//////////////////////////////
function strip_tags(str)
{
    return str.replace(/(<([^>]+)>)/ig,"");
}

function shuffle(o) //셔플
{ 
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}
if (![].includes) {
  Array.prototype.includes = function(searchElement /*, fromIndex*/ ) {
    'use strict';
    var O = Object(this);
    var len = parseInt(O.length) || 0;
    if (len === 0) {
      return false;
    }
    var n = parseInt(arguments[1]) || 0;
    var k;
    if (n >= 0) {
      k = n;
    } else {
      k = len + n;
      if (k < 0) {k = 0;}
    }
    var currentElement;
    while (k < len) {
      currentElement = O[k];
      if (searchElement === currentElement ||
         (searchElement !== searchElement && currentElement !== currentElement)) {
        return true;
      }
      k++;
    }
    return false;
  };
}
Array.prototype.remove = function(v) { for(var i=0;i<this.length;i++)if(this[i]==v){this.splice(i,1);}}
function convertString (obj) {
    var tabjson=[];
    for (var p in obj) {
        if (obj.hasOwnProperty(p)) {
            tabjson.push('"'+p +'"'+ ':' + obj[p]);
        }
    }  tabjson.push()
    return '{'+tabjson.join(',')+'}';
}
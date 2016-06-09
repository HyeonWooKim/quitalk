/**************************************
Quitalk Frontend Library - ZQClient

Server로부터 Receive된 정보를 처리하며 UI 처리까지 같이 처리하는 Javascript파일

Version : 1.0.0.0
제작 시작일 : 2015-01-16
Copyright ⓒ 2015 Quitalk.com
Author : 김현우(kookmin20103324@gmail.com)

http://hae.so
http://quitalk.com

본 소스는 BSD 방식으로 코딩되었습니다.
***************************************/

<?
session_start();
echo "var sid = '".session_id()."';";
unset($_SESSION[token]);
if(!$_SESSION[email]) {$email = "guest_".$_SERVER[REMOTE_ADDR];$guest=1;}
else {$email = $_SESSION[email];$guest=0;}
if(!$_SESSION[nickname]) $nickname = "손님_".substr(md5($email),4,6);
else $nickname = $_SESSION[nickname];
$token=md5(mb_convert_encoding("qui".$email."talk".$nickname,'UTF-8', 'UTF-8'));

?>

var server			= io();
var ID				= "<?=$email?>";
var nick			= "<?=$nickname?>";
var token			= "<?=$token?>";
var isGuest			= <?=$guest?>;
var chattingStack	= 0;
var useItemCount	= 0;
var authed			= 0;
var quizCount		= 0;
var currentChat		= 0;
var balloonskin		= 0;
var lastSender		= "";
var t1=false, t2=false;
var joined			= false;
var started			= false;

//////////////////////////////////////////////////////////////////////////////////
/////////////////////여기부터는 채팅Receive와 관련된 Javascript//////////////////////
//////////////////////////////////////////////////////////////////////////////////

/*
init은 최초 listen시 Server에 data를 보내어 연동하는 과정으로
일종의 handshake 작업이라고 보면 된다. 유저의 email과 token을
인증 수단으로 보낸다. 실패할 경우 자동 disconnect 된다.
*/
server.on('init', function()
{
	if(authed==0)
	{
		server.emit('auth',ID,token);
		authed=1;
	}
});

/*
error 명령어는 top_status_bar에 표시되는 것이 대표적이다.
인증 실패, 중복 접속 등이 대표적인 표시이다.
parameter : 'error', '에러명'
*/
server.on('error',function(q)
{
	alert("오류가 발생하여 접속을 종료합니다. 관리자에게 제보해 주시면 감사합니다.\n\n"+q);
});
server.on('disconnect',function()
{
	/*alert("서버 점검이 시작되었습니다. 잠시 후 이용해 주시기 바랍니다.");
	location.href = "http://quitalk.com";*/
});
server.on('qerror', function(type)
{
	if(type=='DBerror')
	{
		printErrorMessage('#chatting_view','DB 오류가 발생했습니다. 관리자에게 문의해주세요.');
		server.emit('send','disconnect',ID,token,msg);
		server.disconnect();
	}
	if(type=='noAccount')
	{
		printErrorMessage('#chatting_view','먼저 퀴톡에 가입을 하셔야 합니다.<br>쉽고 빠르게 가입하신 후, 퀴톡의 세계를 경험해 보세요!<br><a href="http://quitalk.com" target="_self">바로가기</a>');
		server.disconnect();
	}
	if(type=='invalidToken')	//토큰에러
	{
		//토큰 에러는 100% 해킹에 의한 시도이므로, 시도된 결과를 보고하며 계정을 일시 잠금한다.
		printErrorMessage('#chatting_view','인증에 실패하였습니다.');
		server.disconnect();
	}
	if(type=='blocked')
	{
		printErrorMessage('#chatting_view','해당 계정은 현재 이용이 정지된 계정입니다. 자세한 사항 및 관련된 문의사항은 사이트에 문의바랍니다.');
		server.disconnect();
	}
	if(type=='duplicate')
	{
		//중복 에러는 기존 접속을 해제시키고, 현재 접속을 유지시킨다.
		printErrorMessage('#chatting_view','중복된 접속이 발견되어 이전 접속을 종료시킵니다.');
		server.disconnect();
	}
});

/*
message는 다음과 같이 나누어 진다.
내가 보낸 채팅창은 오른쪽에 정렬되어져 보인다. 상대방이 보낸 채팅창은 왼쪽에 정렬되어 보인다.
global message 및 퀴즈용 message는 상단 가운데에 고정되게 한다. message에는 nickname을
첨부하여 보내기 때문에, 자신의 메시지인지 아닌지를 구별할 수 있다.
*/
server.on('receive',function(command,from,msg,etc,etc2,etc3,etc4,etc5)
{
	if(command=='chat')
	{
		//global 닉네임인 퀴톡으로 보내는 메시지는 가운데 정렬한다.
		//메세지를 send 할 때 data를 보내지 않고, 서버에서 얻은 DB로 닉네임을 세팅하기 때문에
		//client에서는 닉네임을 변동시킬 수 없게 한다.
		if(from=="퀴톡")
		{
			printGlobalMessage('#chatting_view',msg);
		}
		else
		{
			balloonskin = etc;
			printMessage('#chatting_view',from==nick,from,msg);
		}
		var d=document.getElementById("chatting_view");
	}
	else if(command=='chat2')
	{
		var cname="#"+etc;
		balloonskin = etc3;
		var members = etc2.split('|').sort();
		if($(cname).length == 0)
		{
			createChatUI(etc,members);
		}
		if(from=="퀴톡")
		{
			printGlobalMessage(cname,msg);
		}
		else
		{
			printMessage(cname,from==nick,from,msg);
		}
		if(currentChat!=etc)
		{
			addChatCount(etc);
			setPopupMessage(from,msg);
		}
		setChatLastMessage(etc,msg);
		$(cname).scrollTop($(cname)[0].scrollHeight);
	}
	else if(command=="chatAnswer")
	{
		var answerer=from, answer=msg, cname="#"+etc;
		balloonskin = etc2;
		printGlobalMessage(cname,answerer+" 님이 맞추셨습니다!<br>정답은 "+answer+" 입니다.");
		if(currentChat!=etc)
		{
			addChatCount(etc);
			setPopupMessage(from,msg);
		}
		setChatLastMessage(etc,msg);
		$(cname).scrollTop($(cname)[0].scrollHeight);
	}
	else if(command=='count')
	{
		if(!started)
			$('#total_user').html("<img src='http://quitalk.com/icon/people.png' style='width:16px;height:16px;'/><br>"+from);
	}
	else if(command=='globalChat')
	{
		var name=msg;
		printGlobalGameMessage('#'+name,from);
	}
	else if(command=='greet')
	{
		//greet는 초기 인증이 완료될 경우 메시지를 전송해주며, 한번 greet가 된 후에는 더 이상 auth를 하지 않는다.
		$('#total_user').html("<img src='http://quitalk.com/icon/people.png' style='width:16px;height:16px;' /><br>"+from);
	}
	else if(command=='waitFriendRequest')
	{
		setPopupMessage("안내","친구 추가 요청이 들어왔습니다!");
		if(!joined)
			$('#friend_list_word').append("<span style='color:red;font-weight:900;'>["+from+"]</span>");
	}
	else if(command=='ready')
	{
		//ready는 퀴즈에 참여할 준비가 된 유저들에게 퀴즈 버튼을 제공해준다.
		//퀴즈 버튼은 상단 준비 완료 옆에 달리게 되며, 버튼을 누를 경우 래더 참여를 시작하게 된다.
		printGlobalMessage('#chatting_view',nick+" 님 환영합니다!<br>("+from+"점, "+msg+"위)<br>퀴스시작 버튼을 누르면 바로 퀴즈를 즐길 수 있습니다.");
	}
	else if(command=='iconList')
	{
		var iconList = from.split(',');
		if(iconList.length>0)
		{
			$('#iconList').html("<center><span style='font-size:11px;'>아이콘은 1번에 10개까지만 사용가능합니다.<span></center><br>");
			for(var i=0;i<iconList.length;i++)
			{
				$('#iconList').append('<img src="//quitalk.com/images/iconskins/'+iconList[i]+'.png" onclick="insertIcon('+iconList[i]+');" style="width:24px;height:24px;"/> &nbsp;');
			}
		}
	}
	else if(command=='joinRoom')
	{
		//force mode인 상태이므로, 진행중인 개인 채팅 및 창은 일시적으로 종료시킨다.
		clearAllChat();
		//새로 만든 방이든, 기존에 있던 방이든 입장을 시킨다.
		$('#chatting_view').html("");
		started= true;
		joined = true;
		
		//아이템 버튼을 생성한다.
		$('#itemList').html("<img src='http://quitalk.com/icon/item.png' style='width:16px;height:16px;' onclick='showItemList()'/><br>아이템");

		//나가기 버튼을 만들고 게임시작 버튼을 감춘다.
		$('#exit').html("<img src='http://quitalk.com/icon/exit.png' style='width:16px;height:16px;' /><br>나가기");
		$('#game_start').hide();
		$('#loginout').hide();
		$('#friend_list').hide();
		$('#chat_list').hide();
		$('#homepage').hide();
		
		printGlobalMessage('#chatting_view',"입장 완료되었습니다.<br><br>게임에 필요한 인원이 모두 들어오면 퀴즈가 시작됩니다. 퀴즈 시작 이후 나가실 경우 <b>제재</b>를 당하게 됩니다.");
	}
	else if(command=='exitRoom')
	{
		$('#chatting_view').html("");
		joined = false;
		started = false;
		useItemCount = 0;
		quizCount = 0;
		
		//나가기 버튼을 없앤다.
		$('#itemList').html("");
		$('#exit').html("");
		$('#game_start').show();
		$('#loginout').show();
		$('#friend_list').show();
		$('#chat_list').show();
		$('#userInfo').hide();
		$('#homepage').show();

		printGlobalMessage('#chatting_view',nick+" 님 "+from+"점("+msg+"위)<br>퀴스시작 버튼을 누르면 바로 퀴즈를 즐길 수 있습니다.");
		//printGlobalMessage('#chatting_view',"퀴톡 땅따먹기 이벤트 진행중!<br> 상단 메뉴바의 홈페이지->이벤트 클릭으로 참여가능!<br>지금, 참여하시고 <b>CGV 영화티켓, 설빙교환권, 문화상품권</b>을 받아보세요!");
		printGlobalMessage('#chatting_view',"전체랭킹, 공지사항, 퀴톡 패치내역은 상단 '홈페이지' 버튼을 눌러 확인할 수 있습니다.");
	}
	else if(command=='banner')
	{
		var cname = from;
		var adNo = msg;
		printGlobalGameMessage("#"+cname,"<div id='bannerView' style='width:100%; word-break:break-all;'></div>");
		$('#bannerView').load("http://quitalk.com:10086/banner.php?no="+adNo,function(a,b,c)
		{
			$('#'+cname).scrollTop($('#'+cname)[0].scrollHeight);
		});
	}
	else if(command=='chatExit')
	{
		var cname = from;
		var to = msg;
		
		if($("#"+cname).length > 0)
		{
			printGlobalMessage("#"+cname,to+"님이 퇴장하셨습니다.");
			setPopupMessage("안내",to+"님이 퇴장하셨습니다,");
		}
	}
	else if(command=='chatDestroy')
	{
		var cname = from;
		if($("#"+cname).length > 0)
		{
			printGlobalGameMessage("#"+cname,"대화 상대가 모두 나가 채팅방이 종료되었습니다.");
			$('#short_'+cname+'_members').append("(종료됨)");
		}
	}
	else if(command=='refreshUserList')
	{
		//상단의 버튼 모양을 방에 있는 사람으로 만든다.
		$('#user_list').html(from);
		$('#total_user').html("<img src='http://quitalk.com/icon/roompeople.png' style='width:16px;height:16px;' /><br>"+msg+"▼");
	}
	else if(command=='userJoin')
	{
		//유저의 정보를 업데이트 한다.
		if(etc<6 && etc>0)
			printGlobalMessage('#chatting_view',"<center><b>랭킹 "+etc+"위</b> "+from+"("+msg+"점)<br> 님이 입장하셨습니다.");
		else
			printGlobalMessage('#chatting_view',"<center>"+from+"("+msg+"점)<br> 님이 입장하셨습니다.");
	}
	else if(command=='userExit')
	{
		//유저의 정보를 업데이트 한다.
		printGlobalMessage('#chatting_view',from+" 님이 퇴장하셨습니다.");
	}
	else if(command=="userInfo")
	{
		viewUserInfo(from);
	}
	else if(command=="openAd")
	{
		window.open("http://quitalk.com/ad.php?no="+from,"_blank");
	}
	else if(command=='gameStart')
	{
		printGlobalGameMessage('#chatting_view',"20초 뒤에 퀴즈가 시작됩니다.<br> 추가 인원을 15초동안 더 기다립니다.");
	}
	else if(command=='predictLadder')
	{
		printGlobalMessage('#chatting_view',nick+" 님의 예상획득 점수입니다.<br>승리 : "+from+"<br>패배 : "+msg);
	}
	else if(command=='sendQuiz')
	{
		var qtype = from, qno = etc2, qcategory = msg, question = etc;
		quizCount++;
		switch(qtype)
		{
			
			case 1:	//해설보고 영어단어 맞추기
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>"+qno+"/15 번 문제<br>[해설보고 영어단어 맞추기]</center></span><br><center><span style='font-size:15px;'>"+question+"</span>");
			break;
			case 2:	//영어단어(초등)
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>"+qno+"/15 번 문제<br>[영어단어(초등)]</center></span><br><center><span style='font-size:15px;'>"+question+"</span>");
			break;
			case 3:	//자음퀴즈
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>"+qno+"/15 번 문제<br>[자음퀴즈]<br><span style='color:#aa0000;font-weight:900;'>(유형 : "+qcategory+")</span></center></span><br><center><span style='font-size:15px;'>"+question+"</span>");
			break;
			case 4: //이미지퀴즈
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>"+qno+"/15 번 문제<br>[이미지퀴즈]<br><span style='color:#aa0000;font-weight:900;font-size:11px;'>(사진에 나오는 인물/대상/사물의 이름은?)</span></center></span><br><center><div style='font-size:15px;  width:140px; height:120px; text-align:center;'><img src='http://quitalk.com/view.php?no="+question+"' / style='border:2px solid black;'></div><br>&nbsp;");
			break;
			case 5:case 11: //주관식 퀴즈
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>"+qno+"/15 번 문제<br>[주관식퀴즈]<br><span style='color:#aa0000;font-weight:900;'>(유형 : "+qcategory+")</span></center></span><br><center><span style='font-size:15px;'>"+question+"</span>");
			break;
			case 6: //한자성어 읽기
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>"+qno+"/15 번 문제<br>[한자성어]<br><span style='color:#aa0000;font-weight:900;'>아래 뜻을 읽고, 뜻에 해당하는 한자성어를 쓰세요.</span></center></span><br><center><span style='font-size:15px;'>"+question+"</span>");
			break;
			case 7: //한자읽기
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>"+qno+"/15 번 문제<br>[한자읽기]<br><span style='color:#aa0000;font-weight:900;'>한자의 음만 입력하시면 됩니다.</span></center></span><br><center><span style='font-size:24px;'>"+question+"</span>");
			break;
			case 8: //소절 보고 노래 제목 맞추기
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>"+qno+"/15 번 문제<br>[노래 소절보고 제목 맞추기]<br><center><span style='font-size:15px;color:black;'>♬"+question+"</span>");
			break;
			case 9: //지하철 노선도 가운데 역 맞추기
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>"+qno+"/15 번 문제<br>[가운데 들어갈 역의 이름은?]<br><center><span style='font-size:14px;'>"+question+"</span>");
			break;
			case 10: //OX퀴즈
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>"+qno+"/15 번 문제<br>[O/X퀴즈]<br><center><span style='font-size:14px;'>"+question+"<br>(답은 'O' 또는 'X'를 입력해주세요.)</span>");
			break;
		}
	}
	else if(command=='sendInstantQuiz')
	{
		var qtype = from, qcategory = msg, question = etc, cname = '#'+etc2, members=etc3.split('|').sort();
		if($(cname).length == 0)
		{
			createChatUI(etc2,members);
		}
		switch(qtype)
		{
			
			case 1:	//해설보고 영어단어 맞추기
				printGlobalGameMessage(cname,"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>즉석퀴즈<br>[해설보고 영어단어 맞추기]</center></span><br><center><span style='font-size:15px;'>"+question+"</span>");
			break;
			case 2:	//영어단어(초등)
				printGlobalGameMessage(cname,"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>즉석퀴즈<br>[영어단어(초등)]</center></span><br><center><span style='font-size:15px;'>"+question+"</span>");
			break;
			case 3:	//자음퀴즈
				printGlobalGameMessage(cname,"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>즉석퀴즈<br>[자음퀴즈]<br><span style='color:#aa0000;font-weight:900;'>(유형 : "+qcategory+")</span></center></span><br><center><span style='font-size:15px;'>"+question+"</span>");
			break;
			case 4: //이미지퀴즈
				printGlobalGameMessage(cname,"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>즉석퀴즈<br>[이미지퀴즈]<br><span style='color:#aa0000;font-weight:900;font-size:11px;'>(사진에 나오는 인물/대상/사물의 이름은?)</span></center></span><br><center><div style='font-size:15px;  width:140px; height:120px; text-align:center;'><img src='http://quitalk.com/view.php?no="+question+"' / style='border:2px solid black;'></div><br>&nbsp;");
			break;
			case 5:	//주관식 퀴즈
				printGlobalGameMessage(cname,"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>즉석퀴즈<br>[주관식퀴즈]<br><span style='color:#aa0000;font-weight:900;'>(유형 : "+qcategory+")</span></center></span><br><center><span style='font-size:15px;'>"+question+"</span>");
			break;
			case 6: //한자성어 읽기
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>즉석퀴즈<br>[한자성어]<br><span style='color:#aa0000;font-weight:900;'>아래 뜻을 읽고, 뜻에 해당하는 한자성어를 쓰세요.</span></center></span><br><center><span style='font-size:15px;'>"+question+"</span>");
			break;
			case 7: //한자읽기
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>즉석퀴즈<br>[한자읽기]<br><span style='color:#aa0000;font-weight:900;'>한자의 음만 입력하시면 됩니다.</span></center></span><br><center><span style='font-size:24px;'>"+question+"</span>");
			break;
			case 8: //소절 보고 노래 제목 맞추기
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>즉석퀴즈<br>[노래 소절보고 제목 맞추기]<br><center><span style='font-size:15px;color:black;'>♬"+question+"</span>");
			break;
			case 9: //지하철 노선도 가운데 역 맞추기
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>즉석퀴즈<br>[가운데 들어갈 역의 이름은?]<br><center><span style='font-size:14px;'>"+question+"</span>");
			break;
			case 10: //OX퀴즈
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>즉석퀴즈<br>[O/X퀴즈]<br><center><span style='width:90%;word-break:break-all;font-size:14px;'>"+question+"<br>(답은 'O' 또는 'X'를 입력해주세요.)</span>");
			break;
		}
		printGlobalGameMessage(cname,"즉석퀴즈는 제한시간과 힌트가 제공되지 않습니다.");
		if(currentChat != etc2)
		{
			addChatCount(etc2);
			setPopupMessage("안내","즉석 퀴즈가 출제되었습니다!");
			
		}
		setChatLastMessage(etc2,"즉석 퀴즈가 출제되었습니다! 맞춰보세요!");
		$(cname).scrollTop($(cname)[0].scrollHeight);
	}
	else if(command=='sendHint')
	{
		switch(from)
		{
			case 1:	//1번째 힌트
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>[1번째 힌트]</span><br>(남은시간 10초)</center><br><center><span style='font-size:16px;'>"+msg+"</span>");
			break;
			case 2:	//2번째 힌트
				printGlobalGameMessage('#chatting_view',"<span style='color:#0000dd;font-weight:900;font-size:12px;'> <center>[2번째 힌트]</span><br>(남은시간 5초)</center><br><center><span style='font-size:16px;'>"+msg+"</span>");
			break;
		}
	}
	else if(command=='answerLength')
	{
		printGlobalGameMessage('#chatting_view',"이번 문제의 정답은 "+from+"글자입니다.");
	}
	else if(command=='answer')
	{
		balloonskin = etc;
		//정답은 [정답을 제출하셨습니다.] 또는 [정답을 수정하셨습니다.] 로만 보인다.
		if(msg=="1")
		{
			printMessage('#chatting_view',from==nick,from,"<center><span style='color:blue; font-size:13px;'>[정답을 제출하셨습니다.]</span></center>");
		}
		else if(msg=="0")
		{
			printMessage('#chatting_view',from==nick,from,"<center><span style='color:red; font-size:13px;'>[정답을 수정하셨습니다.]</span></center>");
		}
	}
	else if(command=='brokenQuiz')
	{
		printGlobalMessage('#chatting_view',"퀴즈 도중 인원이 나가, 최소인원수에 도달하지 못하여 퀴즈가 강제로 종료되었습니다.<br>이용에 불편을 드려 죄송합니다. 새로운 퀴즈를 진행하시려면 퇴장하시면 됩니다.");
	}
	else if(command=='endGame')
	{
		server.emit('send','exitRoom',ID,token);
	}
	else if(command=='friendRequestList')
	{
		printFriendRequestList("chatting_view",from);
	}
	else if(command=='friendList')
	{
		printFriendList(from);
	}
	else if(command=="inviteFriendList")
	{
		printInviteFriendList(from,msg);
	}
	else if(command=='refreshFriendList')
	{
		getFriendList();
	}	
	else if(command=='alertError')
	{
		alert(from);
	}
	else if(command=='refresh')
	{
		started=false;
		alert("세션이 만료되었거나, 서버가 재시작되었습니다. 다시 접속해 주시기 바랍니다.");
		location.href = "http://quitalk.com";
	}
	else if(command=='completeMakePrivateChat')
	{
		var cname = from;
		var operators = msg;
		var members = etc.split('|').sort();
		//채팅방 div element를 생성한다.
		createChatUI(cname,members);
		if(operators==nick) openChatUI(cname);
	}
	else if(command=='alreadyExistChat')
	{
		var cname = from;
		openChatUI(cname);
	}
	else if(command=='voteGroupPlay')
	{
		voteGroupPlay(from,msg.split('|').sort());
	}
	else if(command=='updateChatUI')
	{
		var members = msg.split('|').sort();
		var cname = from;
		updateChatUI(cname,members);
	}
	else if(command=="exception")
	{
		alert("예기치 못한 오류가 발생하여 재접속합니다.\n\n해당 오류에 대해 자동으로 보고되었으며, 재접속 시 퀴즈 패널티를 받지 않습니다. 불편을 끼쳐드려 죄송하며, 최대한 빨리 원인을 분석하여 수정하겠습니다.\n\n 새로고침 여부를 물어볼 시, 확인을 누르시면 재접속됩니다.");
		location.reload();
	}
	//if(d.scrollHeight - $('#chatting_view').scrollTop()<($('#chatting_view').innerHeight()+30))
		$("#chatting_view").scrollTop($("#chatting_view")[0].scrollHeight);
		
});

function checkSend(event)
{
	var code=event;
	var key=code.keyCode ? code.keyCode : code.which;
	if(key==13)
	{
		if((code.ctrlKey && $('#multi_line').is(":checked")) || (!code.ctrlKey && !$('#multi_line').is(":checked")))
		chatSend(code);
	}
}
function chatSend(event)
{
	$('#iconList').fadeOut(100);
	var msg=strip_tags($.trim($('#send_msg').val()));
	if(msg.length!=0 & msg.length <= 100)
	{
		if(currentChat == 0)
			server.emit('send','chat',ID,token,msg);
		else
			server.emit('send','chat2',ID,token,msg,currentChat);
		$('#send_msg').val("");
	}
	else if(msg.length > 100)
	{
		var target="";
		if(currentChat == 0) target="#chatting_view";
		else target="#"+currentChat;
		printGlobalGameMessage(target,"100자 이상 보내실 수 없습니다.");
	}
	event.preventDefault();
	
	$('#send_msg').focus();
	return false;
}



function gameStart()
{
	if(!started)
	{
		started=true;
		useItemCount = 0;
		server.emit('send','findroom',ID,token);
	}
}

function getFriendList()
{
	if(!started)
	{
		$('#chatting_view').html("");
		server.emit('send','friendList',ID,token);
	}
}

//////////////////////////////////////////////////////////////////////////////////
///////////////////////여기부터는 인터페이스와 관련된 Javascript//////////////////////
//////////////////////////////////////////////////////////////////////////////////
function printErrorMessage(element,msg)
{
	lastSender="퀴톡";
	$(element).append("<div id='global_msg'><span style='font-size:13px;font-weight:900;'>에러</span><br><div id='global_msg_area' class='msg_area'>"+msg+"</div></div>");
}

function printExitMessage(element,msg)
{
	lastSender="퀴톡";
	$(element).append("<div id='global_msg'><div id='exit_msg_area' class='msg_area'>"+msg+"님이 퇴장하셨습니다.</div></div>");
}

function printGlobalMessage(element,msg)
{
	lastSender="퀴톡";
	$(element).append("<div id='global_msg'><span style='font-size:16px;font-weight:700;'>퀴톡</span><br><div id='global_msg_area' class='msg_area'>"+msg+"</div></div>");
	$(element).scrollTop($(element)[0].scrollHeight);
}

function printGlobalGameMessage(element,msg)
{
	lastSender="퀴톡";
	$(element).append("<div id='global_game_msg'><div id='global_game_msg_area'>"+msg+"</div></div>");
	$(element).scrollTop($(element)[0].scrollHeight);
}

function printMessage(element,isMine,from,msg)
{
	var styles = "";
	//스킨 여부를 결정한다.
	if(balloonskin == 0)
	{
		if(isMine)
			styles += "style='background-color:#d9d9fc;'";
		else
			styles += "style='background-color:#ffe7e1;'";
	}
	else styles += "style='background-image:url(\"//quitalk.com/images/balloonskins/"+balloonskin+".jpg\");background-size:90px 90px;background-repeat:repeat; font-weight:700;'";
	var sender="";
	var profiles="";
	if(lastSender != from)
	{
		sender += "<span style='width:100%;font-size:13px;text-align:left;'>"+from+"</span><br>";
		profiles += "<div id='profileShot' style='float:left;text-align:center;width:36px;height:60px;margin:0 0 0 3px;'>"+
		"<img style='border-radius:20px;width:36px;height:36px;' src='http://quitalk.com/profile_view.php?nickname="+from+"' /></div>";
	}
	else
	{
		profiles += "<div id='profileShot' style='float:left;text-align:center;width:36px;height:40px;margin:0 0 0 3px;'>&nbsp;</div>";
	}
	lastSender = from;
	var r="";
	if(isMine)
		$(element).append("<div id='my_msg' class='user_chat'><div id='my_msg_area' class='msg_area'"+styles+">"+msg+"</div></div><br style='clear:both;'/>");
	else
		$(element).append(profiles+
		"<div id='other_msg' class='user_chat' style='float:left;'>"+
		sender+"<div id='other_msg_area' class='msg_area'"+styles+">"+
		msg+"</div></div><br style='clear:both;'/>");
	
}
function exitRoom()
{
	if(confirm("정말로 방에서 나가시겠습니까?\n퀴즈가 진행중이라면 패널티가 부여됩니다."))
	{
		server.emit('send','exitRoom',ID,token);
	}
}
///////////////////////////////////////////////////////////////////////
//채팅과 관련된 함수 모음
///////////////////////////////////////////////////////////////////////
function getChatList()
{
	if(!started)
	{
		var p = $('#chatting_view').offset();
		$('#chatInfo').css(
		{
			"position":"absolute",
			"top":p.top,
			"z-index":20,
			"background-color":"#f9f9f9",
			"left":p.left,
			"overflow-y":"scroll",
			"width":$('#chatting_view').width(),
			"height":$('#chatting_view').height()*0.90
		});
		$('#chatInfo').show();
	}
}
function createChatUI(cname,members)
{
	var mcnt = members.length;
	var mresult = "";
	if(members.length>3)
		mresult = members[0]+","+members[1]+","+members[2]+"님 외 "+(members.length-3)+" 명";
	else
		mresult = members.join(",")+"("+mcnt+" 명)";
	//cname을 id로 가지는 div를 만든다.
	$('body').append(
	"<div id='"+cname+"_menu' class='chatMenu' style='width:"+$('#chatting_view').width()+"px; height:40px; padding:5px 0 0 0; background-color:#f7f7f7;'>"+
		"<div id='"+cname+"_chat_info' style='float:left;font-weight:900;font-size:13px;'>"+mresult+"</div>"+
		"<div style='float:left;margin:0 6px 0 6px;text-align:center;font-size:11px;float:left;' onclick='requestGroupPlay(\""+cname+"\");'><img src='http://quitalk.com/icon/group.png' style='width:18px;height:18px;'/><br>같이하기</div>"+
		"<div style='float:left;margin:0 6px 0 6px;text-align:center;font-size:11px;float:left;' onclick='getInstantQuiz(\""+cname+"\");'><img src='http://quitalk.com/icon/chatquiz.png' style='width:18px;height:18px;'/><br>즉석퀴즈</div>"+
		"<div style='float:left;margin:0 6px 0 6px;text-align:center;font-size:11px;float:left;' onclick='inviteFriend(\""+cname+"\")'><img src='http://quitalk.com/icon/invite.png' style='width:18px;height:18px;'/><br>친구초대</div>"+
	"</div>"+
	"<div id='"+cname+"' class='chatDIV' style='display:none;'></div>");
	
	//채팅목록에 띄워줄 short_cname 으로 append한다.
	$('#chatInfo').append("<div id='short_"+cname+"' onclick='subtractChatCount(\""+cname+"\");openChatUI(\""+cname+"\");' class='chatList' style='width:100%;height:65px;padding:5px 3px 5px 3px; border-bottom:1px solid #e9e9e9'>"+
		"<div id='short_"+cname+"_photo' class='chatPhoto' style='float:left;width:15%;height:100%;padding:3px 5px 3px 12px;'><img style='border-radius:20px;width:40px;height:40px;' src='http://quitalk.com/images/profile/default.jpg' /></div>"+
		"<span id='short_"+cname+"_members' style='font-size:14px;font-weight:900;'>"+mresult+"</span><span id='short_"+cname+"_count' style='font-size:13px;color:red;'></span><br><span id='short_"+cname+"_lastMessage' style='font-size:13px;color:#666666; max-width:70%;'></span></div>");
}

function openChatUI(cname)
{
	//채팅방은 기본적으로 chatDiv라는 class를 가지게 되며, 게임 시작, 친구 목록 등을 눌렀을 때
	//최우선적으로 해당 class를 모두 hide 시켜주는 역할을 한다.
	//채팅방의 크기는 chatting_view와 같게 한다.
	var p = $('#chatting_view').offset();
	$('#'+cname+'_menu').css(
	{
		"position":"absolute",
		"top":p.top,
		"z-index":3,
		"background-color":"#f7f7f7",
		"left":p.left,
	});
	$('#'+cname).css(
	{
		"position":"absolute",
		"top":p.top+40,
		"z-index":3,
		"background-color":"#f7f7f7",
		"left":p.left,
		"overflow-y":"scroll",
		"overflow-x":"hidden",
		"width":$('#chatting_view').width(),
		"height":$('#chatting_view').height()-40
	});
	$(".chatDIV").hide();
	currentChat = cname;
	$('#'+cname).show();
	$('#'+cname+"_menu").show();
	if(typeof($('#'+cname)[0])!="undefined")
		$('#'+cname).scrollTop($('#'+cname)[0].scrollHeight);
}
function updateChatUI(cname,members)
{
	var mcnt = members.length;
	var mresult = "";
	if(members.length>3)
		mresult = members[0]+","+members[1]+","+members[2]+" 외 "+(members.length-3)+"명";
	else
		mresult = members.join(",")+"("+mcnt+"명)";

	$("#"+cname+"_chat_info").html(mresult);
	$("#short_"+cname+"_members").html(mresult);
}
function addChatCount(cname)
{
	var ct = parseInt($('#chat_list_count').text());
	if(isNaN(ct))ct=1;
	else ct++;
	$('#chat_list_count').html(ct);
	var ct = parseInt($('#short_'+cname+'_count').text());
	if(isNaN(ct))ct=1;
	else ct++;
	$('#short_'+cname+'_count').html(ct);	
}
function subtractChatCount(cname)
{
	var ct = parseInt($('#short_'+cname+'_count').text());
	if(isNaN(ct) || ct==0) return;
	$('#short_'+cname+'_count').text("");

	var ct2 = parseInt($('#chat_list_count').text());
	if(isNaN(ct) || ct2==0) return;
	else ct2 -= ct;
	if(ct2 == 0) ct2="";
	$('#chat_list_count').html(ct2);
}

function setPopupMessage(from,msg)
{
	$('#chat_popup').html(from+" <br>"+msg.substr(0,25));
	$('#chat_popup').css({
	"position":"absolute",
	"top":"15%",
	"height":"40px",
	"left":($(window).width()-200)/2+"px",
	"font-size":"13px",
	"z-index":"50"});
	if(msg.length>25)
		$('#chat_popup').append("...");
	if(msg.length>15)
		$('#chat_popup').css("height","60px");
	$('#chat_popup').stop(true, true).fadeIn(500);
	$('#chat_popup').fadeOut(3000);
}
function setChatLastMessage(cname,msg)
{
	$("#short_"+cname+"_lastMessage").html(msg.substr(0,15));
	if(msg.length>15)$("#short_"+cname+"_lastMessage").append("...");
}
function requestGroupPlay(cname)
{
	//Group play를 하기 위해서는 구성원 전체가 동의를 해야 한다.
	//그러므로 전체에게 요청을 하는 메시지를 보낸다.
	if(confirm("같이하기를 하시겠습니까? 방 인원 모두가 동의해야 시작됩니다."))
		server.emit('send','requestGroupPlay',ID,token,cname);
	if(t1 && t2)
	{
		$('#send_msg').focus();
		t2=false;
	}
}

function voteGroupPlay(cname,members)
{
	if($('#'+cname).length == 0)
	{
		createChatUI(cname,members);
	}
	printGlobalMessage('#'+cname,
		"같이하기 투표가 시작되었습니다! 같이하기를 원하실 경우 아래 버튼을 눌러주세요!<br><center><input type='button' onclick='sendAgreeGroupPlay(\""+cname+"\");$(this).hide();' value='같이하기' /></center>");

	if(currentChat != cname)
	{
		setPopupMessage("안내","같이하기 투표가 시작되었습니다! 같이하기를 원하실 경우 아래 버튼을 눌러주세요!");
		addChatCount(cname);
	}
	
	setChatLastMessage(cname,"같이하기 투표가 시작되었습니다! 같이하기를 원하실 경우 아래 버튼을 눌러주세요!");
}

function sendAgreeGroupPlay(cname)
{
	printGlobalGameMessage('#'+cname,"참여가 완료되었습니다.");
	server.emit('send','agreeGroupPlay',ID,token,cname);
}

function getInstantQuiz(cname)
{
	server.emit('send','getInstantQuiz',ID,token,cname);
	if(t1 && t2)
	{
		$('#send_msg').focus();
		t2=false;
	}
}
function inviteFriend(cname)
{
	server.emit('send','inviteFriend',ID,token,cname);
}
/*******************************************************************

여기부터는 Friend와 관련된 함수들의 모임이다.

********************************************************************/

//친구 신청 목록 출력 함수
function printFriendRequestList(cname,from)
{
	var list="";
	if(from!=null)
		list=from.split('|');
	var cnt=list.length;
	var str="<center><br><span style='font-size:20px; color:#444444; font-weight:900;'>퀴톡을 친구들과 함께 즐겨보세요!</span>"+
		"<br><br><input type='text' id='addFriendText' style='color:#bbbbbb;width:60%;height:35px;' onfocus='if(this.value==\"친구신청을 할 닉네임을 입력하세요.\"){this.style.color=\"black\";this.value=\"\"}' onblur='if(this.value==\"\"){this.style.color=\"#bbbbbb\";this.value=\"친구신청을 할 닉네임을 입력하세요.\"}' value='친구신청을 할 닉네임을 입력하세요.'>"+
		"<input type='button' onclick='sendAddFriendRequest($(\"#addFriendText\").val())' value='친구신청' style='height:35px;'/></center><br>";
	if(list!="")
	{
		str+="<span style='font-size:14px;margin:0 0 0 15px;'>친구요청 <span style='color:red;font-weight:900;'>"+list.length+"</span><br><br>";
		for(var i=0;i<cnt;i++)
		{
			var tnick=list[i];
			
			str+="<div class='friendList'>"+
				 "<div id='profileShot' style='float:left;text-align:center;width:19%;height:40px;'>"+
				 "<img style='border-radius:20px;width:40px;height:40px;' src='http://quitalk.com/profile_view.php?nickname="+tnick+"' /></div>"+
				 "<div style='float:left;width:80%;height:40px;'>"+tnick+"<br><input type='button' onclick='acceptFriendRequest(\""+tnick+"\");' value='수락'> <input type='button' onclick='denyFriendRequest(\""+tnick+"\");' value='거부'>";
			str+="</div></div>";
		}
	}
	$('#'+cname).html(str);
}

//친구 목록 출력 함수
function printFriendList(from)
{
	var list=from.split('|');
	var str="";
	$('#friend_list_word').html("친구목록");
	if(list.length==0||$.trim(from)=="")
	{
		str+="<center>친구 목록이 없습니다. 지금 추가해 보세요!</center>";
		
	}
	else
	{
		str+="<span style='font-size:14px;margin:0 0 0 15px;'>친구 <span style='color:orange;font-weight:900;'>"+list.length+"</span> "+
			"<input type='button' value='단체방 만들기' onclick='makePrivateGroupChat(\""+nick+"\")' /><br><br>";
		for(var i=0;i<list.length;i++)
		{
			var tmp=list[i].split(',');
			var tnick=tmp[0],tstate=tmp[1]*1;	//type cast
			
			str+="<div class='friendList'>"+
				 "<div id='profileShot' style='float:left;text-align:center;width:19%;height:55px;'>"+
				 "<img style='border-radius:20px;width:40px;height:40px;' src='http://quitalk.com/profile_view.php?nickname="+tnick+"' /></div>"+
				 "<div style='float:left;width:15%;height:55px;'>"+tnick+"<br>";
			if(tstate==0)str+="<span style='color:gray;font-weight:900;font-size:13px;'>오프라인</span>";
			if(tstate==1)str+="<span style='color:green;font-weight:900;font-size:13px;'>대기중</span>";
			if(tstate==2)str+="<span style='color:red;font-weight:900;font-size:13px;'>퀴즈 진행중</span>";
			str+="</div><div style='float:left;width:65%;height:55px;'>";
			if(tstate!=0)str+="<div style='margin:0 6px 0 6px;text-align:center;font-size:11px;float:left;'><input type='checkbox' class='userGroup' value='"+tnick+"' style='width:15px;height:15px;'/><br>단체방</div><div style='margin:0 6px 0 6px;text-align:center;font-size:11px;float:left;' onclick='makePrivateChat(\""+tnick+"\",\""+nick+"\");'><img src='http://quitalk.com/icon/chat.png' style='width:18px;height:18px;'/><br>1:1채팅</div>";
			str+="<div onclick='deleteFriend(\""+tnick+"\")' style='cursor:pointer; margin:0 6px 0 6px;text-align:center;font-size:11px;float:left'><img src='http://quitalk.com/icon/delete.png' style='width:18px;height:18px;'/><br>친구삭제</div>";
			str+="</div>";
		}
	}
	$('#chatting_view').append(str);
}

//친구 초대 목록 출력 함수
function printInviteFriendList(from,cname)
{
	$('#inviteList').html("");
	var list=from.split('|');
	var str="<center><div style='width:100%;height:40px;background-color:#febb35;padding:5px 0 0 0;'> <span style='font-size:20px;'>친구초대</div><br>";
	$('#friend_list_word').html("친구목록");
	if(list.length==0||$.trim(from)=="")
	{
		str+="<center>초대 가능한 인원이 없습니다.</center><br><br>";
		
	}
	else
	{
		str+="<input type='button' value='초대하기' onclick='invitePrivateGroupChat(\""+cname+"\")' />&nbsp;&nbsp;&nbsp;<input type='button' value='닫기' onclick='$(\"#inviteList\").hide();' /><br><br><span style='font-size:14px;'>초대할 친구를 선택한 후, 초대하기 버튼을 눌러주세요.</span></center>";
		for(var i=0;i<list.length;i++)
		{
			var tmp=list[i].split(',');
			var tnick=tmp[0],tstate=tmp[1]*1;	//type cast

			if(tnick=="")continue;
			
			str+="<div class='friendList'>"+
				 "<div id='profileShot' style='float:left;text-align:center;width:19%;height:55px;'>"+
				 "<img style='border-radius:20px;width:40px;height:40px;' src='http://quitalk.com/profile_view.php?nickname="+tnick+"' /></div>"+
				 "<div style='float:left;width:15%;height:55px;'>"+tnick+"<br>";
			if(tstate==0)str+="<span style='color:gray;font-weight:900;font-size:13px;'>오프라인</span>";
			if(tstate==1)str+="<span style='color:green;font-weight:900;font-size:13px;'>대기중</span>";
			if(tstate==2)str+="<span style='color:red;font-weight:900;font-size:13px;'>퀴즈 진행중</span>";
			str+="</div><div style='float:left;width:65%;height:55px;'>";
			if(tstate!=0)str+="<div style='margin:0 6px 0 6px;text-align:center;font-size:11px;float:left;'><input type='checkbox' class='inviteGroup' value='"+tnick+"' style='width:16px;height:16px;'/><br>초대하기</div>";
			str+="</div>";
		}
	}
	$('#inviteList').append(str);
	var p = $('#top_status_bar').offset();
	$('#inviteList').css({"width":$('#top_status_bar').width(),"top":p.top,"left":p.left,"background-color":"#f7f7f7"});
	$('#inviteList').fadeIn(500);
}


//친구신청 함수
function sendAddFriendRequest(nickname)
{
	nickname=$.trim(nickname);
	if(nickname!="" && nickname != "친구신청을 할 닉네임을 입력하세요.")
	{
		if(nickname == nick)
			alert("자기 자신에게 신청할 수 없습니다.")
		else
			server.emit('send','addFriendRequest',ID,token,nickname);
	}
}

//친구신청 수락 함수
function acceptFriendRequest(fnick)
{
	server.emit('send','acceptFriendRequest',ID,token,fnick);
}

//친구신청 거절 함수
function denyFriendRequest(fnick)
{
	if(confirm("해당 유저가 더 이상 친구추가 신청을 할 수 없게 차단하시겠습니까?"))
	{
		server.emit('send','blockFriend',ID,token,fnick);
	}
	server.emit('send','denyFriendRequest',ID,token,fnick);
}

//친구삭제 함수
function deleteFriend(fnick)
{
	if(confirm("정말로 "+fnick+" 님을 친구목록에서 삭제하시겠습니까?\n상대방 목록에서도 자동으로 친구삭제가 됩니다."))
	{
		server.emit('send','deleteFriend',ID,token,fnick);
	}
}

//private chat(유저들간의 채팅)함수
function makePrivateChat(to,from)
{
	if(confirm("채팅을 하시겠습니까?"))
	{
		//to는 채팅방에 초대되는 대상, from은 방장이다.
		to = $.trim(to);
		from = $.trim(from);
		if(to!="" && from != "")
			server.emit('send','makePrivateChat',ID,token,to,from);
	}
}

//단체방을 만드는 함수
function makePrivateGroupChat(from)
{
	var list = $('.userGroup:checkbox:checked').map(function()
	{
		return this.value;
	}).get();
	if(!list.length)
	{
		alert("단체방에 초대할 인원을 선택해 주세요.");
		return;
	}
	else
	{
		if(confirm("방을 만드시겠습니까?"))
		{
			from = $.trim(from);
			if(from!="")
				server.emit('send','makePrivateChat',ID,token,list,from);
		}
	}
}
function invitePrivateGroupChat(cname)
{
	
	var list = $('.inviteGroup:checkbox:checked').map(function()
	{
		return this.value;
	}).get();
	if(!list.length)
	{
		alert("초대할 인원을 선택해 주세요.");
		return;
	}
	else
	{
		if(confirm("초대하시겠습니까?"))
		{
			server.emit('send','invitePrivateChat',ID,token,list,cname);	
			$('#inviteList').fadeOut(500);
		}
	}
}

function viewUserInfo(str)
{
	hideInfo();
	list=str.split('|');
	var str="<span onclick='hideInfo();' style='font-size:13px;cursor:pointer;'>닫기</span><br><br>";
	//0,2,4,...:닉네임,1,3,5:점수
	for(var i=0;i<list.length-1;i+=2)
	{
		str+=list[i]+"("+list[i+1]+" 점)<br>";
	}
	var p = $('#total_user').offset();
	$('#userInfo').css("top",p.top+40);
	$('#userInfo').css("left",p.left);
	$('#userInfo').html(str);
	$('#userInfo').show();
	if(t1 && t2)
	{
		$('#send_msg').focus();
		t2=false;
	}
}
function useItem(num)
{
	if(useItemCount==3)
		printGlobalMessage('#chatting_view',"아이템을 더 이상 사용하실 수 없습니다.");
	else
	{
		switch(num)
		{
			case 1:		//미리보기
				if(quizCount<1)
					printGlobalMessage('#chatting_view',"첫번째 문제에서는 미리보기를 사용하실 수 없습니다.");
				else
				{
					server.emit('send','useItem',ID,token,1);
					hideInfo();
				}
			break;
			case 2:case 3:case 4:case 5:case 6:		//폭식
				server.emit('send','useItem',ID,token,num);
				hideInfo();
			break;
		}
	}
	if(t1 && t2)
	{
		$('#send_msg').focus();
		t2=false;
	}
}
function viewItemInfo()
{
	hideInfo();
	var p = $('#itemList').offset();
	$('#itemInfo').css("top",p.top+40);
	$('#itemInfo').css("left",p.left-50);
	$('#itemInfo').show();
	if(t1 && t2)
	{
		$('#send_msg').focus();
		t2=false;
	}
}
function viewIconInfo()
{
	hideInfo();
	var q = $('#bottom_send').offset();
	$('#iconList').css({"left":q.left,"top":q.top-80});
	$('#iconList').show();
	if(t1 && t2)
	{
		$('#send_msg').focus();
		t2=false;
	}
}

function insertIcon(no)
{
	$('#send_msg').focus();
	$('#send_msg').val($('#send_msg').val()+"[i"+no+"]");
}
//////////////////Event Handler/////////////////////////
$(function()
{
	if(isGuest)
		$('#loginout').html('<img src="//quitalk.com/icon/login.png" style="width:16px; height:16px;" /><br>로그인');
	else
		$('#loginout').html('<img src="//quitalk.com/icon/logout.png" style="width:16px; height:16px;" /><br>로그아웃');
	resizeLayout();
});
$(window).resize(function()
{
	resizeLayout();
});

$(window).on('beforeunload', function()
{
		return "정말로 종료하시겠습니까?\n진행중인 채팅은 저장되지 않으며, 퀴즈가 진행중이시라면 패널티 및 계정 제재를 받습니다.";
});
$(function()
{
	$('#chatting_view').click(function()
	{
		t1=false;
		hideInfo();
	});
	$('#send_msg').focus(function(){t1=true;t2=false;})
	$('#send_msg').blur(function(){t2=true;})
	$('#total_user').click(function()
	{
		if(joined)
			server.emit('send','userInfo',ID,token);
	});
	$('#itemList').click(function()
	{
		viewItemInfo();
	});
	$('#iconBtn').click(function()
	{
		viewIconInfo();
	});
});
function clearAllChat()
{
	currentChat = 0;
	$('#iconList').hide();
	$('.chatDIV').hide();
	$('.chatMenu').hide();
}
function hideInfo()
{
	$('#userInfo').hide();
	$('#itemInfo').hide();
	$('#iconList').hide();
}
function resizeLayout()
{
	//Layout의 상단은 어떠한 경우에도 57px로 고정한다.
	//그러므로 windowY에서 남은 길이를 기준으로 비율을 바꾼다.
	var WindowX=$(window).width();
	var WindowY=$(window).height();

	var chatHeight=(WindowY-40)*0.84;
	var bottomHeight=(WindowY-40)*0.16;
	if(WindowX>900)
		$('#whole_container').css("width","550px");
	else
		$('#whole_container').css("width","100%");

	$('#top_status_bar').css("height","40px");
	$('#chatting_view').css("height",chatHeight);
	var p = $('#chatting_view').offset();
	$('.chatDIV').css({"width":$('#chatting_view').width(),"height":chatHeight-40,"top":p.top+40,"left":p.left});
	
	$('.chatMenu').css({"top":p.top,"left":p.left,"width":$('#chatting_view').width()});
	$('#bottom_send').css("height",bottomHeight);
	var q = $('#bottom_send').offset();
	$('#iconList').css({"top":q.top-80,"width":$('#whole_container').width(),"left":p.left});
	$("#chatting_view").scrollTop($("#chatting_view")[0].scrollHeight);
	if($('#'+currentChat).length>0)
		$('#'+currentChat).scrollTop($('#'+currentChat)[0].scrollHeight);
	$('#chatInfo').css({"top":p.top,height:chatHeight*0.9});
}
function reserveAdvertise()
{
	server.emit('send','reserveAdvertise',ID,token);
	$('#bannerView').hide();
}

String.prototype.insert = function (index, string) {
  if (index > 0)
    return this.substring(0, index) + string + this.substring(index, this.length);
  else
    return string + this;
};
function strip_tags(str)
{
    return str.replace(/(<([^>]+)>)/ig,"");
}
jQuery.expr[':'].focus = function( elem ) {
  return elem === document.activeElement && ( elem.type || elem.href );
};
<?

/*****************************************************
index.php

퀴톡 홈페이지 메인화면. 게임 인터페이스에서 홈페이지 버튼 클릭시 접속되는 부분.
http://quitalk.com/?r=1 로 접속시 홈페이지로 접속된다.

Author : 김현우(kookmin20103324@gmail.com)

*****************************************************/

//일반 접속시 게임 인터페이스로 리다이렉트
if(!$_GET[r])
	header('Location: http://quitalk.com:10086/game.html');

session_start();
$connect = mysqli_connect(/*개인 DB정보 입력*/) or alert("DB 접속에 실패하였습니다.");
$connect->query("set names utf8");

include_once("modules/common.php");

$quizCount = mysqli_fetch_array(mysqli_query($connect, "select count(*) from quitalk_question"),MYSQLI_BOTH);
?>

<!DOCTYPE html>
<html>
<head>
<title>메신저형 퀴즈 애플리케이션, 퀴톡 for Haeso</title>
<meta name="viewport" content="width=device-width, user-scalable=no">
<script src="//ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js"></script>
<script src="js/interface.js"></script>
<style>
/*index.php css*/
@import url(http://fonts.googleapis.com/earlyaccess/nanumgothic.css);
*
{
	font-family: 'Nanum Gothic', serif;﻿
}
body
{
	width:100%;
	height:100%;
	overflow-x:hidden;
	background-color:#f0f0f0;
	margin:0 auto;
}
#topArea1,#topArea1 a
{
	background-color:#4d8789;
	width:100%;
	height:120px;
	color:#f4e822;
	font-size:16px;
	text-align:center;
	text-decoration:none;
}
#contentArea
{
	margin:0 auto;
	padding:5px 5px 15px 5px;
	font-size:15px;
	border:1px solid #c0c0c0;
	width:320px;
	background-color:white;
	border-radius:6px;
	text-align:center;
}
#startArea
{
	margin:0 auto;
	font-size:25px;

	width:300px;
	height:30px;
	background-color:white;
	border-radius:6px;
	text-align:center;
	vertical-align:middle;
}
#startBtn
{
	text-decoration:none;
	color:#0000aa;
	font-size:20px;
}
</style>
</head>
<body>
<div id="topArea1">
	<br><a href="http://quitalk.com/?r=1"><span style='font-size:20px;'>메신저형 퀴즈 애플리케이션, 퀴톡</span></a><br><br><span style='font-size:16px;'>여러분들을 위해<br><?=$quizCount[0]?></span> 문제가 준비되어 있습니다.<br>
	<br>
</div><br>
<div id="contentArea"><br>
<?if(!$_SESSION[logged]){?>
	<span style='display:inline-block;cursor:pointer;' onclick='location.href="event.php";'><img src='icon/mainevent.png'><br>이벤트(클릭!)</span><br><br>
	퀴톡을 시작하시려면 로그인 해주세요.<br>
	<a href="login.php?go=http://quitalk.com" target="_self">로그인 또는 가입하기</a><br>

	<?}else{
	$connect->query("use quitalk");
	$qg = "select * from quitalk_member where email='{$_SESSION[email]}'";
	$member=mysqli_fetch_array(mysqli_query($connect,$qg),MYSQLI_BOTH);
	if(!$member)
	{
		echo "{$_SESSION[nickname]} 님은 아직 퀴톡 서비스에 가입하지 않으셨습니다.
		<br> 시작하기 버튼만 누르면 퀴톡 계정이 바로 만들어집니다.";?>
		<input type='button' onclick='window.open("register.php","_self");' value='시작하기' /><br>
		<?
		
	}
	else
	{
		echo "<img style='border-radius:20px;width:60px;height:60px;' src='profile_view.php?nickname=".$_SESSION[nickname]."' /><br><span style='font-size:32px;'>{$member[nickname]}</span><br>
		<br>
		<span style='font-size:20px;'> {$member[rate]}점 / {$member[points]}포인트</span><br>".getUserLevelName($member[rate])."<a style='text-decoration:none;'href='tutorial/#t2'>[계급표]</a><br><br>
		<span style='display:inline-block;cursor:pointer;' onclick='location.href=\"http://quitalk.com:10086/game.html\";'><img src='icon/start.png'><br>게임시작</span>&nbsp;&nbsp;
		<span style='display:inline-block;cursor:pointer;' onclick='location.href=\"shop.php\";'><img src='//quitalk.com/icon/shop.png'><br>상점</span>
		&nbsp;&nbsp;
		<span style='display:inline-block;cursor:pointer;' onclick='location.href=\"event.php\";'><img src='icon/mainevent.png'><br>이벤트</span>&nbsp;&nbsp;
		<span style='display:inline-block;cursor:pointer;' onclick='location.href=\"info.php\";'><img src='//quitalk.com/icon/modify.png'><br>정보수정</span>&nbsp;&nbsp;
		<span style='display:inline-block;cursor:pointer;' onclick='location.href=\"auth.php\";'><img src='//quitalk.com/icon/logout.png'><br>로그아웃</span>";
	}
	}?>
	<br><br>
	<!--<b>현재 퀴톡 서버점검으로 인해 <br>플레이가 불가능합니다.</b><br><br>-->
	<a href="http://blog.hae.so/category/%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD/%ED%8C%A8%EC%B9%98%EB%85%B8%ED%8A%B8" target="_blank">퀴톡 패치노트</a><br>
	<a href="http://blog.hae.so/guestbook" target="_blank">건의/아이디어/의견제보 하기</a>
</div>
<center>
<span style="font-size:13px;">
<a style='display:inline-block;cursor:pointer;color:black;text-decoration:none;' href="http://quitalk.com/tutorial";'><img src='//quitalk.com/icon/tutorial.png' style='width:64px;height:64px;'><br><b>[필독]퀴톡을 처음하는 사람들을 위한 설명서(클릭!)</b></a><br><br>
<center>

<b style="font-size:17px;">랭킹</b><br><br>
<div id="contentArea">
<table style="width:100%;">
<?
include_once("modules/common.php");

$sql = "select * from quitalk_member order by rate desc limit 0,5";
$chk =mysqli_query($connect,$sql);
$no= 0; $stack=0; $last=0;
while($ret = mysqli_fetch_array($chk,MYSQLI_BOTH))
{
	if($last != $ret[rate])
	{
		$no+=$stack;$stack=0;$no++;
	}
	else $stack++;
	echo "<tr style='text-align:center;'><td style='width:15%;'>".$no."위</td><td style='width:45%;'>".$ret[nickname]."(".$ret[rate].")</td><td style='width:40%;'>".getUserLevelName($ret[rate])."</td></tr>";
	$last = $ret[rate];
}

?>
</table>

<br><a href='rank.php' target='_self'>더보기</a>
</div>
</center>
<br>퀴톡은 <b>설치할 필요 없이,</b><br> PC, android, iOS 구분 없이, 인터넷 브라우저만 있다면<br>어디에서나 이용 가능합니다.<br><br>문의/건의/제안/아이디어제보 등은<br>메일(quitalk.com@gmail.com 또는 kookmin20103324@gmail.com)<br>카카오톡(haeso)</span>
</center>
</body>
</html>

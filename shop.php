<?
/*****************************************************
shop.php

아이콘, 스킨(게임 내 말풍선 배경)을 판매하는 상점 UI 및 소스
*****************************************************/
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
<script>
function buy(t,v)
{
	if(confirm("정말로 해당 상품을 구매하시겠습니까?"))
	{
		$.post("buy.php",{type:t, value:v},function(e){alert(e);});
	}
}
</script>
<script src="//ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js"></script>
<script src="js/interface.js"></script>
<style>
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
#topArea1
{
	background-color:#4d8789;
	width:100%;
	height:120px;
	color:#f4e822;
	font-size:16px;
	text-align:center;
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
	<br><span style='font-size:20px;'>메신저형 퀴즈 애플리케이션, 퀴톡</span><br><br><span style='font-size:16px;'>여러분들을 위해<br><?=$quizCount[0]?></span> 문제가 준비되어 있습니다.<br>
	<br>
</div><br>
<div id="contentArea"><br>
<?if(!$_SESSION[logged]){?>
	계정 정보가 없습니다.<br>
	<a href="login.php?go=http://quitalk.com" target="_self">로그인 또는 가입하기</a>
	<?}else{
	$connect->query("use quitalk");
	$qg = "select * from quitalk_member where email='{$_SESSION[email]}'";
	$member=mysqli_fetch_array(mysqli_query($connect,$qg),MYSQLI_BOTH);
	if(!$member)
	{
		echo "{$_SESSION[nickname]} 님은 아직 퀴톡 서비스에 가입하지 않으셨습니다.
		<br> 시작하기 버튼을 눌러 퀴톡 계정을 만들어주세요.";?>
		<input type='button' onclick='window.open("register.php","_self");' value='시작하기' /><?
		
	}
	else
	{
		echo "<img style='border-radius:20px;width:60px;height:60px;' src='profile_view.php?nickname=".$_SESSION[nickname]."' /><br><span style='font-size:32px;'>{$member[nickname]}</span><br>
		<br>
		<span style='font-size:20px;'> {$member[rate]}점 / {$member[points]}포인트</span><br>".getUserLevelName($member[rate])."<a style='text-decoration:none;'href='tutorial/#t2'>[계급표]</a><br><br>
		<span style='display:inline-block;cursor:pointer;' onclick='location.href=\"http://quitalk.com:10086/game.html\";'><img src='icon/start.png'><br>퀴톡시작</span>&nbsp;&nbsp;<span style='display:inline-block;cursor:pointer;' onclick='location.href=\"index.php\";'><img src='icon/home.png' style='width:32px;height:32px;'><br>홈으로</span>";
	}
	}?>
	<br><a href="http://blog.hae.so/category/%EA%B3%B5%EC%A7%80%EC%82%AC%ED%95%AD/%ED%8C%A8%EC%B9%98%EB%85%B8%ED%8A%B8" target="_blank">퀴톡 패치노트</a><br>
	<a href="http://blog.hae.so/guestbook" target="_blank">건의/아이디어/의견제보 하기</a>
</div>
<center>
<span style="font-size:13px;">
<br>말풍선 스킨<br>채팅 시 배경화면에 적용되는 스킨입니다.
<div id="contentArea" style="height:500px; overflow-x:hidden; overflow-y:scroll;">
<?
$ret=mysqli_query($connect,"select * from quitalk_shop where type=1 order by no desc limit 0,20");
echo "<table style='width:100%; border-collapse:collapse;'>";
while($item = mysqli_fetch_array($ret,MYSQLI_BOTH))
{
	echo "<tr style='width:100%; font-size:13px; text-align:left;'><td style='width:70px; border-bottom:1px solid #e0e0e0;'><img style='width:70px;height:70px;border-radius:15px;' src='images/balloonskins/".$item[value].".jpg' /></td>
			<td style='border-bottom:1px solid #e0e0e0; padding:2px 2px 2px 2px;'><b>".$item[name]."</b>(<img src='icon/cost.png' />".$item[price].")<br>남은 수량 : ".$item[lefts]." &nbsp;<input type='button' value='구매' onclick='buy(1,".$item[value].");' /></td></tr>";
}
echo "</table>";
?>
</div>
<br>아이콘 스킨<br>채팅 대화에 넣을 수 있는 아이콘입니다.
<div id="contentArea" style="height:500px; overflow-x:hidden; overflow-y:scroll;">
<?
$ret=mysqli_query($connect,"select * from quitalk_shop where type=2 order by no desc limit 0,20");
echo "<table style='width:100%; border-collapse:collapse;'>";
while($item = mysqli_fetch_array($ret,MYSQLI_BOTH))
{
	echo "<tr style='width:100%; font-size:13px; text-align:left;'><td style='width:40px; border-bottom:1px solid #e0e0e0;'><img style='width:32px;height:32px;' src='images/iconskins/".$item[value].".png' /></td>
			<td style='border-bottom:1px solid #e0e0e0; padding:2px 2px 2px 2px;'><b>".$item[name]."</b>(<img src='icon/cost.png' />".$item[price].")<br>남은 수량 : ".$item[lefts]." &nbsp;<input type='button' value='구매' onclick='buy(2,".$item[value].");' /></td></tr>";
}
echo "</table>";
?>
</div>

<br>퀴톡은 <b>설치할 필요 없이,</b><br> PC, android, iOS 구분 없이, 인터넷 브라우저만 있다면<br>어디에서나 이용 가능합니다.<br><br>Icon made by Freepik from www.flaticon.com </span>
</span>
</center>
</body>
</html>

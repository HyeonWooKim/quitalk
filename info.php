<?

/*****************************************************
info.php

개인정보, 프로필 사진 등을 확인하고 변경할 수 있는 페이지

Author : 김현우(kookmin20103324@gmail.com)

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
	padding:5px 15px 15px 15px;
	font-size:15px;
	border:1px solid #c0c0c0;
	width:300px;
	background-color:white;
	border-radius:6px;
	font-size:14px;
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
	<?}else if(!$_SESSION[passed] && !$_POST){?>
	정보 수정을 진행합니다.<br>비밀번호를 1번 더 입력해 주세요.<br><br>
	<form method="post">
	<input type="password" name="pass" style="height:25px; width:80%; border:1px solid #888888;" /><br><br>
	<input type="submit" value="완료" /><br>
	</form>
	<?}else
	{
		$connect->query("use haeso");
		$password = md5(md5($_POST[pass]));
		$query = "select * from haeso_member where email='{$_SESSION[email]}' and password='{$password}'";
		$member=mysqli_fetch_array(mysqli_query($connect,$query),MYSQLI_BOTH);
		//die(print_r($member));
		if(!$member && !$_SESSION[passed])
		{
			?>
			정보 수정을 진행합니다.<br>비밀번호를 1번 더 입력해 주세요.<br><br>
			<form method="post">
			<input type="password" name="pass" style="height:25px; width:80%; border:1px solid #888888;" /><br><br>
			<input type="submit" value="완료" /><br>
			</form><?
			die("<script>alert('비밀번호가 올바르지 않습니다.');</script>");
		}
		else
		{
			$connect->query("use quitalk");
			//이번엔 퀴톡 데이터를 읽어온다.
			$qg = "select * from quitalk_member where email='{$_SESSION[email]}'";
			$member=mysqli_fetch_array(mysqli_query($connect,$qg),MYSQLI_BOTH);
			if(!$member)
			{
				echo "{$_SESSION[nickname]} 님은 아직 퀴톡 서비스에 가입하지 않으셨습니다.
				<br> 시작하기 버튼만 누르면 퀴톡 계정이 바로 만들어집니다.";?>
				<input type='button' onclick='window.open("register.php","_self");' value='시작하기' /><?
				
			}
			else
			{
				if(!$_SESSION[email] || (count($_POST) != 1 && !$_SESSION[passed]))
					die("<script>alert('잘못된 접근입니다.');</script>");
				if($_SESSION[passed])
					unset($_SESSION[passed]);
				//프사 주소 경로 : ../images/profile/(email의 첫번째 글자)/md5(email).(jpg|png) max 100kb
				//사진 저장시에는 확장자를 지우고 저장.
				echo "<center><span style='display:inline-block;cursor:pointer;' onclick='location.href=\"index.php\";'><img src='icon/home.png' style='width:32px;height:32px;'><br>홈으로</span></center><br><center style='font-size:24px;'>정보수정</center><br><br>";
				echo "<span style='text-align:left;'>닉네임</span>
				<form method='post' action='changenick.php'>
				<input type='text' name='nickname' value='{$member[nickname]}' style='width:40%; font-size:18px; height:24px;'/>
				<input type='submit' value='변경하기' />
				</form>
				<span style='font-size:13px;'>닉네임은 2~6자 내에서 가능합니다.
				닉네임 변경에는 <b>1000포인트</b>가 필요합니다. 부적절한 닉네임은 추후에 강제로 변경될 수 있으며, 포인트 환불이 되지 않습니다.<br><br><hr noshade>
				프로필 사진";
				echo "<br>현재 프로필 사진 : <img src='profile_view.php?nickname=".$member[nickname]."' style='width:60px;height:60px;' />
				<br>바꿀 프로필 사진 : <form method='post' action='profile_upload.php' enctype='multipart/form-data'> <input type='file' name='profilepic' accept='image/png, image/jpeg; capture=\'gallery\''/><br><br><center><input type='submit' value='변경하기' /></form></center><br>
				프로필 사진은 jpg,png만 가능합니다. 크기는 60x60으로 맞춰지니 가능한 정사각형으로 조정하시는 것이 좋으며, 가로 또는 세로의 길이가 300을 넘을 수 없습니다. 용량은 200kb를 넘을 수 없습니다.<br><br>";
				echo "<hr noshade>";
				//보유하고 있는 스킨 목록을 불러온다.
				//5개씩 한다.
				echo "말풍선 스킨 변경<br>변경하고자 하는 스킨의 적용 버튼을 눌러주세요.
				<table style='width:100%;border-collapse:collapse;'><tr style='text-align:center;width:100%;'>";

				$qg = "select * from quitalk_items where type=1 and email='{$_SESSION[email]}'";
				$i=0;
				$send=mysqli_query($connect,$qg);
				while($items = mysqli_fetch_array($send,MYSQLI_BOTH))
				{
					$i++;
					echo "<td style='width:25%; border:1px solid #686868;'><img style='max-width:60px;width:100%;height:auto;' src='images/balloonskins/".$items[value].".jpg' /><br>";
					if($items[value] == $member[balloonskin]) echo"사용 중";
					else
					{
						echo "<form method='post' action='changeskin.php'><input type='hidden' name='skinno' value='".$items[value]."' /><input type='submit' value='적용' /></form>";
					}
					echo "</td>";
					if($i==4)
					{
						$i=0;
						echo "</tr><tr style='text-align:center;width:100%;'>";
					}
				}
				if($i!=4)echo "</tr>";
				echo "</table>";
			}
		}
	}?>
	
</div>
<center>
<span style="font-size:13px;">
<br>퀴톡은 <b>설치할 필요 없이,</b><br> PC, android, iOS 구분 없이, 인터넷 브라우저만 있다면<br>어디에서나 이용 가능합니다.<br><br></span>
</center>
</body>
</html>

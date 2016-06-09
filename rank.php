<?

/*****************************************************
rank.php


Author : 김현우(kookmin20103324@gmail.com)
가입된 유저들의 순위를 보여주는 소스
*****************************************************/


session_start();
$connect = mysqli_connect(/*개인 DB정보 입력*/) or alert("DB 접속에 실패하였습니다.");
$connect->query("set names utf8");

include_once("modules/common.php");

$quizCount = mysqli_fetch_array(mysqli_query($connect, "select count(*) from quitalk_question"),MYSQLI_BOTH);

if((!$_GET['page'] || !is_numeric($_GET['page']))&&(!$_GET['no']||!is_numeric($_GET['no'])))
			$page=1;
		else
		{
			if(!$_GET['no']||!is_numeric($_GET['no']))
				$page=$_GET['page'];
			else
				$page=(int)(($total_cnt-$_GET[no])/20)+1;
		}
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
	<br><a href="http://quitalk.com"><span style='font-size:20px;'>메신저형 퀴즈 애플리케이션, 퀴톡</span></a><br><br><span style='font-size:16px;'>여러분들을 위해<br><?=$quizCount[0]?></span> 문제가 준비되어 있습니다.<br>
	<br>
</div><br><center><br>
<span style="font-size:13px;">
퀴톡 랭킹입니다. 랭킹은 퀴즈를 풀며 얻은 레이팅 점수를 토대로 산출합니다.
<div id="contentArea"><br>
<table style="width:100%;">
<?
include_once("modules/common.php");

$connect = mysqli_connect(/*개인 DB정보 입력*/) or alert("DB 접속에 실패하였습니다.");
$connect->query("set names utf8");

$sql = "select * from quitalk_member order by rate desc limit ".(($page-1)*20).",20";
$chk =mysqli_query($connect,$sql);
$no= 0; $stack=0; $last=0;
while($ret = mysqli_fetch_array($chk,MYSQLI_BOTH))
{
	if($last != $ret[rate])
	{
		$no+=$stack;$stack=0;$no++;
	}
	else $stack++;
	echo "<tr style='text-align:center;'><td style='width:15%;'>".$no."위</td><td style='width:55%;'>".$ret[nickname]."(".$ret[rate].")</td><td style='width:30%;'>".getUserLevelName($ret[rate])."</td></tr>";
	$last = $ret[rate];
}
		
?>
</table>
<br><br>
<span style='font-size:16px; text-decoration:none;'>
<?
		//hae.so Page count system
		//2014-06-10 시스템 변경 완료
		//현재 페이지를 page 변수가 아닌 글의 번호를 기준으로 구한다.

		//글이 1000개가 있고, 현재글이 860번, 페이지당 20개씩 노출된다면
		//(int)(1000-860)/20 = 7
		$q3="select count(*) from quitalk_member";
		$c3=mysqli_fetch_array(mysqli_query($connect,$q3),MYSQLI_BOTH);
		$total_cnt=intval($c3[0]);
		//페이지가 존재하지 않을 경우, no parameter에 의하여 구한다.(2014-06-10)
		
		$start_page = (int)(($page-1)/10)*10+1;
		$end_page = $start_page+9;
		$total_page = ceil($total_cnt/20);	//존재할 수 있는 페이지 수
		$pageT=($page-1)*20;
		if($start_page > 10)
		{
			$temp = ($start_page-1);
			
			
			echo "<a style='cursor:pointer;font-size:24px;'' href='?page=1".$sh."'>《 </a>"; 
			echo "<a style='cursor:pointer;font-size:24px;'' href='?page=".$temp.$sh."'>〈 </a>";
		}
		for($i=$start_page; $i<=$end_page; $i++)
		{
			if($i > $total_page) break;
			if($i != $page)
				echo "<a style='cursor:pointer;font-size:24px;' href='?page=".$i.$sh."'>".$i." </a>&nbsp;";
			else
				echo "<b style='color:red;font-size:24px;'>".$i."</b>&nbsp;&nbsp;";
		}
		if($end_page < $total_page)
		{
			$temp = $end_page+1;
			$jms = $total_page;
			echo "<a style='cursor:pointer;font-size:24px;'' href='?page=".$temp."".$sh." '> 〉</a>";
			echo "<a style='cursor:pointer;font-size:24px;'' href='?page=".$jms."".$sh." '>  》</a>";
		}
?>
</span>
</div>
</span>
</center>
</body>
</html>
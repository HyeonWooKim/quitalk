<?

/*****************************************************

changeskin.php
스킨 변경을 처리하는 부분이다.
유효성을 검증한 후 스킨을 변경한다.

*****************************************************/

session_start();
$connect = mysqli_connect(/*개인 DB정보 입력*/) or alert("DB 접속에 실패하였습니다.");
$connect->query("set names utf8");

if(!$_POST || !$_SESSION[email] || !is_numeric($_POST[skinno])) die();

//세션 email에 기반한 정보를 가져온다.
$sql = "select * from quitalk_member where email='{$_SESSION[email]}'";
$member=mysqli_fetch_array(mysqli_query($connect,$sql),MYSQLI_BOTH);

if(!$member[email])
	alert("일시적으로 오류가 발생하였습니다. 다시 시도하시거나, 로그아웃 후 다시 로그인해주세요.");

if($member[balloonskin] == $_POST[skinno])
	alert("이미 사용중인 스킨입니다.");

//보유하고 있는 아이템인지 확인한다.
$sql = "select * from quitalk_items where email='{$_SESSION[email]}' and type=1 and value='{$_POST[skinno]}'";
$items=mysqli_fetch_array(mysqli_query($connect,$sql),MYSQLI_BOTH);

if(!$items[value])
	alert("보유하고 있는 스킨이 아닙니다.");

mysqli_query($connect,"update quitalk_member set balloonskin='{$_POST[skinno]}' where email='{$_SESSION[email]}'") or alert("변경 도중 오류가 발생하였습니다. 관리자에게 문의해주세요.");

$_SESSION[passed] = 1;

alert("스킨이 변경되었습니다.");

function alert($str)
{
	die("<script>alert('".$str."');location.href='info.php';</script>");
}
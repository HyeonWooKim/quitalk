<?

/*****************************************************

ad.php
퀴즈 중간에 나오는 광고를 시청할 경우 포인트를 지급한다.
종료된 광고는 포인트를 제공하지 않는다.

*****************************************************/

session_start();
if(!$_GET || !is_numeric($_GET[no]) || !$_SESSION[email]) die();
$connect = mysqli_connect(/*개인 DB정보 입력*/) or alert("DB 접속에 실패하였습니다.");
$connect -> query("set names utf8");

//streak table에 해당 no의 보상이 이미 제공되었다면 중복 제공하지 않는다.
$no = mysqli_real_escape_string($connect,$_GET[no]);
$chk = mysqli_fetch_array(mysqli_query($connect, "select * from quitalk_banner_streak where email='{$_SESSION[email]}'"),MYSQLI_BOTH);

$banner = mysqli_fetch_array(mysqli_query($connect, "select * from quitalk_banner where imageno={$no}"),MYSQLI_BOTH);

if($banner[remain]==0)
	die("<script>alert('종료된 광고입니다.');window.close();</script>");

if(!$chk[email])
{
	mysqli_query($connect,"update quitalk_member set point=point+{$banner[streak]} where email='{$_SESSION[email]}'");
	mysqli_query($connect,"update quitalk_banner set remain=remain-1 where no='{$no}'");
	mysqli_query($connect,"insert quitalk_banner_streak(email,imageno) values('{$_SESSION[email]}','{$no}')");
}
else die("<script>alert('이미 포인트가 지급된 광고입니다.');location.href='{$banner[redirect]}';</script>");
die("<script>alert('{$banner[streak]} 포인트가 지급되었습니다.');location.href='{$banner[redirect]}';</script>");
?>
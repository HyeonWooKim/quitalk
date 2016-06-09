<?

/*****************************************************
profile_view.php


Author : 김현우(kookmin20103324@gmail.com)
등록된 프로필사진을 로드하여 보여주는 소스
*****************************************************/

if(!$_GET || !$_GET['nickname']) die();

$connect = mysqli_connect("localhost","root","wrpgained","quitalk") or alert("DB 접속에 실패하였습니다.");
$connect->query("set names utf8");

if(mb_strlen($_GET[nickname])>9 || mb_strlen($_GET[nickname])<2)die();

$nickname = mysqli_real_escape_string($connect,$_GET[nickname]);

$sql = "select email from quitalk_member where nickname='{$nickname}'";
$ret = mysqli_query($connect,$sql) or die(mysqli_error($connect));
$member=mysqli_fetch_array($ret,MYSQLI_BOTH);

//파일 이름은 email의 첫글자/md5(md5(email))(확장자) 이다.
$fileDir = "images/profile/".substr($member[email],0,1)."/";
$fileName = md5(md5($member[email])).".jpg";
if(!is_dir($fileDir) || !file_exists($fileDir.$fileName))
{
	$fileDir = "images/profile/";
	$fileName = "default.jpg";
}
header('Content-type : image/png');
echo file_get_contents($fileDir.$fileName);

?>
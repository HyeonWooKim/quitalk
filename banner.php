<?

/*****************************************************

banner.php
퀴즈 중간에 나오는 배너를 관리한다.
배너는 노출 횟수가 남아있는 것 중 랜덤으로 출력한다.

*****************************************************/

session_start();
if(!$_GET || !is_numeric($_GET[no])) die();
$connect = mysqli_connect(/*개인 DB정보 입력*/) or alert("DB 접속에 실패하였습니다.");
$connect->query("set names utf8");

//배너에 대한 config를 읽어온다.
$config = mysqli_fetch_array(mysqli_query($connect, "select * from quitalk_config"),MYSQLI_BOTH);

$totalCount = $config[totalBannerCount];

//존재하지 않는 배너 읽기 시도 차단
if($totalCount < $_GET[no]) die();

$currentCount = mysqli_real_escape_string($connect,$_GET[no]);

//currentCount에 대한 배너 정보를 읽어온다.
$banner = mysqli_fetch_array(mysqli_query($connect, "select * from quitalk_banner where imageno='{$currentCount}'"),MYSQLI_BOTH);

echo $banner[subject]."<span style='font-size:12px;'><br><br><img src='http://quitalk.com/images/banner/{$currentCount}.png'/><br>".$banner[content]."<br>&lt;구독시 <span style='color:red;'>".$banner[streak]."</span> 포인트를 드립니다.&gt;(최초 1회)</span><input type='button' value='광고보기' onclick='reserveAdvertise();' />";

?>
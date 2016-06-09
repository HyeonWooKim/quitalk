<?

/*****************************************************

buy.php
상점에서 물건을 구매할 시 구매를 처리하는 부분이다.

*****************************************************/

if($_GET)die();

session_start();
$connect = mysqli_connect(/*개인 DB정보 입력*/) or alert("DB 접속에 실패하였습니다.");
$connect->query("set names utf8");

//값과 밸류를 안전하게 변경한다.
$type = mysqli_real_escape_string($connect,$_POST[type]);
$value = mysqli_real_escape_string($connect,$_POST[value]);
$email = mysqli_real_escape_string($connect,$_SESSION[email]);

$sql = "select * from quitalk_member where email='{$email}'";
$member=mysqli_fetch_array(mysqli_query($connect,$sql),MYSQLI_BOTH);


//아이콘이 남아 있는지 확인한다.
$sql = "select * from quitalk_shop where type='{$type}' and value='{$value}'";
$ret = mysqli_fetch_array(mysqli_query($connect, $sql),MYSQLI_BOTH);

if($ret[lefts]==0)
	die("품절된 상품입니다.");

//살 수 있는지 확인한다.
if($ret[price]>$member[points])
	die("보유하신 포인트가 부족합니다.");

$price = $ret[price];

//이미 보유하고 있는지 확인한다.
$sql = "select * from quitalk_items where email='{$email}' and type='{$type}' and value='{$value}'";
$ret = mysqli_fetch_array(mysqli_query($connect, $sql),MYSQLI_BOTH);
if($ret[type]) die("이미 보유하고 있는 상품입니다.");

//구매할 수 있으므로 먼저 아이콘을 차감한다.
mysqli_query($connect,"update quitalk_shop set lefts=lefts-1 where type='{$type}' and value='{$value}'") or die("구매 도중 오류가 발생하였습니다. 관리자에게 문의 바랍니다. ERROR01");

//보유한 포인트를 차감한다.
mysqli_query($connect,"update quitalk_member set points=points-{$price} where email='{$email}'") or die("구매 도중 오류가 발생하였습니다. 관리자에게 문의 바랍니다. ERROR02");

//해당 정보를 삽입한다.
mysqli_query($connect,"insert quitalk_items(email,type,value) values('{$email}','{$type}','{$value}');") or die("구매 도중 오류가 발생하였습니다. 관리자에게 문의 바랍니다. ERROR03");

die("구매가 완료되었습니다.");

?>
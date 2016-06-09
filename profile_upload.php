<?
/*****************************************************
profile_upload.php

Profile Photo File upload System
Author : 김현우(kookmin20103324@gmail.com)
프로필 사진 업로드 소스코드
*****************************************************/
session_start();
if(!$_SESSION || !$_FILES) die();

//비어있는 FILES를 제출하면, 제거를 의미한다.
if($_FILES && $_FILES["profilepic"]["name"]=="")
{
	$fileDir = "images/profile/".substr($_SESSION[email],0,1)."/";
	$fileName = md5(md5($_SESSION[email])).".jpg";
	unlink($fileDir.$fileName);
	alert("프로필 사진이 제거되었습니다.");
}

//먼저 헤더를 검사한다.
$header = array("image/png","image/jpeg","image/jpg");

if(!in_array($_FILES["profilepic"]["type"],$header))
	alert("유효하지 않은 파일입니다.");

//용량 200kb(즉, 204800byte를 넘을 수 없다.)
if($_FILES["profilepic"]["size"]>204800)
	alert("파일 사이즈가 200kb를 넘습니다.");

//확장자를 체크한다.
$extensions = array(".jpg",".png",".jpeg");
$fileExtension = strrchr($_FILES["profilepic"]["name"],".");

if(!in_array($fileExtension,$extensions))
	alert("유효하지 않은 파일입니다.");

$uploadImage=0;
$k=0;

//사진 크기를 체크한다.
list($width, $height) = getimagesize($_FILES["profilepic"]["tmp_name"]);
if($width>300 || $height>300) alert("사진의 가로 또는 세로가 너무 큽니다. 300px 이하로 조정해 주시기 바랍니다.");

//이미지 체크가 끝났으므로 파일 저장을 시작한다.

//파일 이름은 email의 첫글자/md5(md5(email))(확장자) 이다.
$fileDir = "images/profile/".substr($_SESSION[email],0,1)."/";
$fileName = md5(md5($_SESSION[email])).".jpg";
if(!is_dir($fileDir))
{
    mkdir($fileDir);
}
move_uploaded_file($_FILES["profilepic"]["tmp_name"],$fileDir.$fileName) or alert("실패");
chmod($fileDir.$fileName,0666);

$_SESSION[passed] = 1;
alert("업로드가 완료되었습니다.");


function alert($str)
{
	die("<script>alert('".$str."');location.href='info.php';</script>");
}
?>
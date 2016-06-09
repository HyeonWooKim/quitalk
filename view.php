<?
/*****************************************************
view.php

이미지 퀴즈에 필요한 이미지를 보여주는 소스
*****************************************************/
error_reporting(E_ALL);
ini_set("display_errors","1");

if(!$_GET || !is_numeric($_GET['no'])) die();

$dir= floor($_GET['no']/2000)+1;
$name = md5("image".md5($_GET['no']));



$file = "http://hae.so/quitalk/images/".$dir."/".$name.".jpg";

header('Content-type : image/jpeg');
//header('Content-Length: ' . filesize($file));
echo file_get_contents($file);

?>
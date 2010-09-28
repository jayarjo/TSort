<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>Huge Table Test</title>
<script type="text/javascript" src="js/requisites.js"></script>
<script type="text/javascript" src="tsort.js"></script>

<link rel="stylesheet" href="css/tsort.css" type="text/css" />


</head>

<body>

<div id="grid"> </div>	

<button onclick="grid.tsort('hideCol', 'column_1')">Hide First Column</button>
<button onclick="grid.tsort('unhideCol', 'column_1')">UnHide First Column</button>

<br />

<button onclick="grid.tsort('hideCol', 'column_2')">Hide Second Column</button>
<button onclick="grid.tsort('unhideCol', 'column_2')">UnHide Second Column</button>

<script>

	var grid = $('#grid').tsort({
		url: 'data.php'
	});
	

</script>


</body>
</html>

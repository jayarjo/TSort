<?php

$data = array(

	'OK' => 1,

	'page' => (is_numeric($_REQUEST['page']) ? $_REQUEST['page'] : 1),
	'totalRows' => 1000,
	
	'rows' => array()

);


for ($i = 0; $i < $_REQUEST['rowsPerPage']; $i++)
	for ($ii = 0; $ii < 3; $ii++)
		$data['rows'][$i][$ii] = "{$data['page']}-$ii-$i" . uniqid('', true);


echo json_encode($data);

?>
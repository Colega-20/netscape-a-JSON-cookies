 // Función para procesar archivos
 function openFile(event) {
  var input = event.target;
  files = input.files;
  var convertButton = document.getElementById('convert');
  convertButton.onclick = function () {
  for (var i = 0; i < files.length; i++) {
  var reader = new FileReader();
  var file_obj = files[i];
  var filename = file_obj.name; // Obtener el nombre original del archivo
  reader.onload = (function (file, name) { // Pasar el nombre original del archivo como parámetro
  return function (e) {
  var cookie_string = e.target.result;
  var res = extractCookies(cookie_string);
  var res_json = JSON.stringify(res, null, 4);
  download(res_json, name, 'text/plain'); // Utilizar el nombre original al descargar
  };
  })(file_obj, filename); // Pasar el nombre original del archivo como segundo argumento
  reader.readAsText(file_obj);
  }};}

  // Función para extraer cookies
  function extractCookies(text) {
  var cookies = [];
  var lines = text.split("\n");
  lines.forEach(function (line, index) {
  var tokens = line.split("\t");
  if (tokens.length == 7) {
  tokens = tokens.map(function (e) {
  return e.trim();
  });
  var cookie = {};
  cookie.name = tokens[5];
  cookie.value = tokens[6];
  cookie.domain = tokens[0];
  cookie.hostOnly = false;
  cookie.path = tokens[2];
  cookie.secure = tokens[3] === 'TRUE';
  cookie.httpOnly = false;
  cookie.session = false;
  cookie.storeId = "firefox-default";
  var timestamp = tokens[4];          
  if (timestamp.length == 17) {
  timestamp = Math.floor(timestamp / 1000000 - 11644473600);
  }
  cookie.expirationDate = parseInt(timestamp);
  cookies.push(cookie);
  }});
  return cookies;
}

// Función para descargar el archivo JSON
function download(text, name, type) {
  var a = document.createElement("a");
  var file = new Blob([text], { type: type });
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
}
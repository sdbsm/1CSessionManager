
var path = require('path');
var fs = require('fs');

// Проверка наличия node-windows
try {
  var Service = require('node-windows').Service;
} catch (err) {
  console.error('ERROR: node-windows module not found!');
  console.error('Error:', err.message);
  process.exit(1);
}

// Create a new service object
var svc = new Service({
  name: '1C Session Manager',
  script: path.join(__dirname, 'server.js')
});

// Listen for the "uninstall" event so we know when it's done.
svc.on('uninstall', function(){
  console.log('Uninstall complete.');
  console.log('The service exists: ', svc.exists);
  process.exit(0);
});

svc.on('error', function(err){
  console.error('Service uninstall error:', err);
  console.error('Error details:', err.message);
  process.exit(1);
});

// Uninstall the service.
console.log('Uninstalling service...');
try {
  svc.uninstall();
} catch (err) {
  console.error('Failed to uninstall service:', err);
  console.error('Error stack:', err.stack);
  process.exit(1);
}

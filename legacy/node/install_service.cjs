
var path = require('path');
var fs = require('fs');

// Проверка наличия node-windows
try {
  var Service = require('node-windows').Service;
} catch (err) {
  console.error('ERROR: node-windows module not found!');
  console.error('Please run: npm install node-windows');
  console.error('Error:', err.message);
  process.exit(1);
}

// Проверка наличия необходимых файлов
var serverPath = path.join(__dirname, 'server.js');
if (!fs.existsSync(serverPath)) {
  console.error('ERROR: server.js not found at:', serverPath);
  process.exit(1);
}

console.log('Installing service...');
console.log('Server script:', serverPath);

// Create a new service object
var svc = new Service({
  name: '1C Session Manager',
  description: 'Automated 1C Session Management and Limit Enforcement Service',
  script: serverPath,
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function(){
  console.log('Service installed successfully!');
  console.log('Starting service...');
  svc.start();
});

svc.on('alreadyinstalled', function(){
  console.log('Service is already installed.');
  console.log('Starting service...');
  svc.start();
});

svc.on('start', function(){
  console.log('Service started successfully!');
  process.exit(0);
});

svc.on('error', function(err){
  console.error('Service error:', err);
  console.error('Error details:', err.message);
  process.exit(1);
});

// Install the script as a service.
console.log('Calling svc.install()...');
try {
  svc.install();
} catch (err) {
  console.error('Failed to install service:', err);
  console.error('Error stack:', err.stack);
  process.exit(1);
}

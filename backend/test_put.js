const jwt = require('jsonwebtoken');

async function test() {
  const token = jwt.sign(
    { id: '123', phoneNumber: '+917980357754', role: 'ADMIN' },
    'MmAaTtHhEeMmAaNnIiAaCc@#789030',
    { expiresIn: '1h' }
  );
  
  try {
    const res = await fetch('http://localhost:3000/api/v1/superuser/admins/2fed78e3-fa1d-4b1c-8879-d246a603e16a/branch', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        branch: 'Sodepur, Barrackpore'
      })
    });
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error(err);
  }
}
test();

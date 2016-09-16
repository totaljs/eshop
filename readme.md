[![MIT License][license-image]][license-url]

[![Support](https://www.totaljs.com/img/button-support.png?v=2)](https://www.totaljs.com/support/)

# Node.js Eshop

Please do not change the code, just create a new issues. I solve all problems as soon as possible. Do you want special upgrades? Contact us [www.totaljs.com/support](https://www.totaljs.com/support/).

__IMPORTANT: PLEASE DON'T CHANGE DATA IN MONGODB AND POSTGRESQL DATABASES. CREATE YOUR OWN BACKUP AND RESTORE IT ON YOU SERVERS OR CLOUD.__

- New version: `v7.0.0` (works only with __Total.js v2.1.0__)

---

## The source-code

- `eshop` NoSQL embedded version
- `eshop-postgresql` PostgreSQL version
- `eshop-mongodb` MongoDB version
- `backup` contains backup of MongoDB and PostgreSQL database


---

## Installation

- install `npm install total.js`
- install `npm install paypal-express-checkout`

### MongoDB version only

- install `npm install sqlagent`
- install `npm install mongodb`
- __note__: cloud database www.mongolab.com
- __important__: binary files are too slow because I have a free billing plan and the servers are in USA

### PostgreSQL version only

- install `npm install sqlagent`
- install `npm install pg`
- install `npm install pg-large-object`
- __note__: cloud database www.elephantsql.com
- __important__: binary files are too slow because I have a free billing plan and the servers are in USA

[license-image]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat
[license-url]: license.txt


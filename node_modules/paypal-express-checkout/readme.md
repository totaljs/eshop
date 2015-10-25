Node.js PayPal Express checkout for single payment
==================================================

* Simple and easy use
* __No dependencies__
* [Demo paypal](https://github.com/petersirka/partial.js/tree/master/examples/paypal) with the [partial.js web application framework](https://github.com/petersirka/partial.js)

PayPal account
--------------

![PayPal account](http://partialjs.com/exports/paypal-info.jpg)

<https://developer.paypal.com/webapps/developer/applications/accounts>

***

```text
$ npm install paypal-express-checkout
```

***

```js

var paypal = require('paypal-express-checkout').init('username', 'password', 'signature', 'return url', 'cancel url', [debug]);

// debug = optional, default false
// paypal.pay('Invoice nubmer', amout, 'description', 'currency', callback);
// checkout

paypal.pay('20130001', 123.23, 'iPad', 'EUR', function(err, url) {
	
	if (err) {
		console.log(err);
		return;
	}

	// redirect to paypal webpage
	response.redirect(url);
});

// result in GET method
// paypal.detail('token', 'PayerID', callback);
// or
// paypal.detail(totaljs.controller, callback);

paypal.detail('EC-788441863R616634K', '9TM892TKTDWCE', function(err, data, invoiceNumber, price) {
	
	if (err) {
		console.log(err);
		return;
	}

	/*
	data (object) =
	{ TOKEN: 'EC-35S39602J3144082X',
	  TIMESTAMP: '2013-01-27T08:47:50Z',
	  CORRELATIONID: 'e51b76c4b3dc1',
	  ACK: 'Success',
	  VERSION: '52.0',
	  BUILD: '4181146',
	  TRANSACTIONID: '87S10228Y4778651P',
	  TRANSACTIONTYPE: 'expresscheckout',
	  PAYMENTTYPE: 'instant',
	  ORDERTIME: '2013-01-27T08:47:49Z',
	  AMT: '10.00',
	  TAXAMT: '0.00',
	  CURRENCYCODE: 'EUR',
	  PAYMENTSTATUS: 'Pending',
	  PENDINGREASON: 'multicurrency',
	  REASONCODE: 'None' };
	*/

});

```

## PayPal PAYMENTSTATUS

```
Canceled_Reversal: A reversal has been canceled. For example, you won a dispute with the customer, and the funds for the transaction that was reversed have been returned to you.
Completed: The payment has been completed, and the funds have been added successfully to your account balance.
Created: A German ELV payment is made using Express Checkout.
Denied: You denied the payment. This happens only if the payment was previously pending because of possible reasons described for the pending_reason variable or the Fraud_Management_Filters_x variable.
Expired: This authorization has expired and cannot be captured.
Failed: The payment has failed. This happens only if the payment was made from your customer’s bank account.
Pending: The payment is pending. See pending_reason for more information.
Refunded: You refunded the payment.
Reversed: A payment was reversed due to a chargeback or other type of reversal. The funds have been removed from your account balance and returned to the buyer. The reason for the reversal is specified in the ReasonCode element.
Processed: A payment has been accepted.
Voided: This authorization has been voided.
```

## How to prevent of pending paymentstatus?

> Login into your bussiness account and click here: https://www.sandbox.paypal.com/ca/cgi-bin/?cmd=_profile-pref&source=acct_setup&fli=true

## Contact

<http://www.petersirka.sk>

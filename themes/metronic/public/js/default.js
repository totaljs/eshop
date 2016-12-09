// Online visitors counter
PING('GET /api/ping/');

$(document).ready(function () {

    var path = $('.breadcrumb a').eq(2).attr('href');
    if (path)
        $('.categories').find('a[href="' + path + '"]').addClass('selected');

    $(document).on('click', '.header-menu-button, .categories-button', function () {
        $('.categories').toggleClass('categories-toggle');
    });

    $(document).on('click', '.categories-button', function () {
        $('.categories').parent().toggleClass('categories-hide');
    });

    var buy = $('.detail-buy').on('click', function () {

        var el = $(this);
        var price = parseFloat(el.attr('data-price'));
        var count = parseInt($('#product-quantity').val());
        var id = el.attr('data-id');

        var checkout = FIND('checkout');
        var qty = count;
        //if (checkout.exists(id) && checkout.exists(id).count)
        //    qty += checkout.exists(id).count;

        var result = -1;
        if (optional && !optional.dynForm) // dynamic personnal forms : example product with options
            result = checkout.add(id, qty, false);
        /*     return AJAX('POST /erp/api/product/combined', {
         product: {
         id: id,
         dynForm: optional.dynForm
         },
         optional: optional,
         qty: qty,
         save: true
         }, function (response) {
         if (!response)
         return console.log("error add product");
         
         console.log(response);
         
         refresh(true);
         //checkout.append(id, response.pu_ht, count, optional);
         var target = $('.detail-checkout');
		target.find('.data-checkout-count').html(checkout.exists(id).count + 'x');
         target.slideDown(300);
         });*/


        var data = {};

        if (result !== -1) // Not found
            data = {
                product: id,
                qty: result.count,
                optional: result.optional,
                save: true
            };
        else
            data = {
                product: id,
                qty: qty,
                optional: optional,
                save: true
            };

        //classic form
        AJAX('POST /api/price/', data, function (response) {
            //console.log(response);

            if (response && response.optional && response.optional.cartId)
                checkout.append(id, response.pu_ht, count, response.optional);

            refresh(true);
            var target = $('.detail-checkout');
            target.find('.data-checkout-count').html(data.qty + 'x');
            if (data.qty)
                target.removeClass('hidden');

            target.slideDown(300);
        });
    });

    // Is detail
    if (buy.length > 0) {
        setTimeout(function () {
            var item = FIND('checkout').exists(buy.attr('data-id'));
            if (!item)
                return;
            var target = $('.detail-checkout');
			target.find('.data-checkout-count').html(item.count + 'x');
            target.slideDown(300);
        }, 1000);
    }

    loading(false, 800);
});

COMPONENT('related', function () {
    var self = this;
    self.readonly();
    self.make = function () {
        AJAX('GET /api/products/', {html: 1, category: self.attr('data-category'), max: 8, skip: self.attr('data-id')}, function (response) {
            var parent = self.element.parent();
            if (parent.hasClass('hidden') && response.indexOf('id="empty"') === -1)
                parent.removeClass('hidden');
            self.html(response);
        });
    };
});

COMPONENT('emaildecode', function () {
    var self = this;
    self.readonly();
    self.make = function () {
        var m = self.element.html().replace(/\(\w+\)/g, function (value) {
            switch (value) {
                case '(at)':
                    return '@';
                case '(dot)':
                    return '.';
            }
            return value;
        });
        self.element.html('<a href="mailto:' + m + '">' + m + '</a>');
    };
});

COMPONENT('newsletter', function () {
    var self = this;
    var button;
    var input;

    self.readonly();
    self.make = function () {

        button = self.find('button');
        input = self.find('input');

        self.element.on('keydown', 'input', function (e) {
            if (e.keyCode !== 13)
                return;
            button.trigger('click');
        });

        button.on('click', function () {

            var mail = input.val();
            if (!mail.isEmail())
                return;

            AJAX('POST /api/newsletter/', {email: input.val()}, function (response) {

                if (response.success) {
                    input.addClass('newsletter-success');
                    input.val(self.attr('data-success'));
                }

                setTimeout(function () {
                    input.val('');
                    input.removeClass('newsletter-success');
                }, 3000);
            });
        });

    };
});

COMPONENT('checkout', function () {
    var self = this;
    var expiration = ((1000 * 60) * 60) * 168; // Valid for 7 days
    var currency = self.element.find(".total").attr('data-currency');

    self.make = function () {
        self.refresh();
    };

    self.exists = function (id) {
        var cart = CACHE('cart');
        if (!cart)
            return;
        for (var i = 0, length = cart.length; i < length; i++) {
            if (cart[i].id === id)
                return cart[i];
        }
    };

    self.count = function (id) {
        var cart = CACHE('cart');
        var count = 0;
        if (!cart)
            return 0;
        for (var i = 0, length = cart.length; i < length; i++) {
            if (cart[i].id === id)
                count += cart[i].count;
        }

        return count;

    };

    self.append = function (id, price, count, optional) {
        var cart = CACHE('cart');
        var is = false;
        var counter = 0;

        if (cart) {
            if (!optional && !optional.dynForm)
                for (var i = 0, length = cart.length; i < length; i++) {
                    if (cart[i].id !== id)
                        continue;
                    cart[i].count += count;
                    cart[i].price = price;
                    cart[i].optional = optional;
                    is = true;
                    break;
                }
        } else
            cart = [];

        if (!is || optional)
            cart.push({id: id, price: price, count: count, optional: optional});

        CACHE('cart', cart, expiration);
        self.refresh();
        return count;
    };

    self.add = function (id, inc, refresh) {
        var cart = CACHE('cart');
        var is = false;
        var line;

        if (cart) {
            for (var i = 0, length = cart.length; i < length; i++) {
                if (cart[i].id !== id && cart[i].optional.cartId !== id)
                    continue;
                cart[i].count += inc;

                line = cart[i];
                is = true;
                break;
            }
        } else
            cart = [];

        if (!is)
            return -1; //Not fount

        CACHE('cart', cart, expiration);
        if (refresh)
            self.refresh();
        return line;
    };

    self.remove = function (id, inc, refresh) {
        var cart = CACHE('cart');
        var is = false;
        var line;

        if (cart) {
            for (var i = 0, length = cart.length; i < length; i++) {
                if (cart[i].id !== id && cart[i].optional.cartId !== id)
                    continue;
                cart[i].count -= inc;
                if (cart[i].count < 0)
                    cart[i].count = 0;

                line = cart[i];
                is = true;
                break;
            }
        } else
            cart = [];

        if (!is)
            return -1; //Not fount

        CACHE('cart', cart, expiration);
        if (refresh)
            self.refresh();
        return line;
    };

    self.update = function (id, count, price, optional) {

        // Possible return values:
        // -1 = without change
        // 0  = removed
        // 1  = updated

        var cart = CACHE('cart');
        if (!cart)
            return -1;

        var removed = false;
        for (var i = 0, length = cart.length; i < length; i++) {
            var item = cart[i];
            if (item.id !== id)
                continue;

            if (count === item.count && price === item.price)
                return -1;

            if (count <= 0 || price <= 0) {
                cart.splice(i, 1);
                removed = true;
            } else {
                item.count = count;
                item.price = price;
                item.optional = optional;
            }

            break;
        }

        CACHE('cart', cart, expiration);
        self.refresh(removed ? 1 : 0);
        return 1;
        //return removed ? 1 : 0;
    };

    self.clear = function () {
        CACHE('cart', [], expiration);
        self.refresh(1);
    };

    self.read = function () {
        return CACHE('cart');
    };

    self.get = function (id) {
        var cart = CACHE('cart');
        if (!cart)
            return;
        return cart.findItem('id', id);
    };

    self.refresh = function () {

        var cart = CACHE('cart');
        if (!cart || !cart.length) {
            self.element.find(".total").html(currency.format('0.00'));
            self.element.find(".count").html("0 item");
            return;
        }

        var sum = 0;
        var count = 0;

        for (var i = 0, length = cart.length; i < length; i++) {
            sum += cart[i].price * cart[i].count;
            count += cart[i].count;
        }

        self.element.find(".total").html(currency.format(sum.format(2)));
        self.element.find(".count").html(count + " items");
    };
});

function loading(visible, timeout) {
    var el = $('#loading');

    if (!visible && !el.length)
        return;

    if (!el.length) {
        $(document.body).append('<div id="loading"></div>');
        el = $('#loading');
    }

    setTimeout(function () {
        if (visible)
            el.fadeIn(500);
        else
            el.fadeOut(500);
    }, timeout || 0);
}

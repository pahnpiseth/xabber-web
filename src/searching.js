define("xabber-searching", function () {
    return function (xabber) {
        var env = xabber.env,
            constants = env.constants,
            templates = env.templates.searching,
            utils = env.utils,
            $ = env.$,
            $iq = env.$iq,
            $msg = env.$msg,
            $pres = env.$pres,
            Strophe = env.Strophe,
            _ = env._,
            moment = env.moment,
            uuid = env.uuid,
            Images = utils.images;

        xabber.DiscoveringView = xabber.BasicView.extend({
            className: 'searching-main noselect',
            template: templates.searching_wide,
            ps_selector: '.chats-list-wrap',
            ps_settings: {
                wheelPropagation: true,
                theme: 'existing-chats-list'
            },

            avatar_size: constants.AVATAR_SIZES.SYNCHRONIZE_ACCOUNT_ITEM,

            events: {
                "click .account-field .dropdown-content": "selectAccount",
                "click .btn-cancel": "close",
                "click .btn-search": "search",
                "click .existing-chat-wrap": "getChatProperties",
                "keyup .search-input": "keyUp"
            },

            _initialize: function () {
                this.data.on("change:color", this.colorUpdated, this);
                this.$('.searching-properties-field .dropdown-button').on('click', function () {
                    this.toggleProperties();
                }.bind(this));
            },

            render: function (options) {
                this.endDiscovering();
                this.data.set('color','#9E9E9E');
                options || (options = {});
                var accounts = xabber.accounts.connected,
                    jid = options.jid || '';
                this.$('.single-acc').showIf(accounts.length === 1);
                this.$('.multiple-acc').hideIf(accounts.length === 1);
                this.$('.account-field .dropdown-content').empty();
                _.each(accounts, function (account) {
                    this.$('.account-field .dropdown-content').append(
                        this.renderAccountItem(account));
                }.bind(this));
                if (accounts.length)
                    this.bindAccount(accounts[0]);
                this.$('#select-searching-properties .account-field .dropdown-button').dropdown({
                    inDuration: 100,
                    outDuration: 100,
                    constrainWidth: false,
                    hover: false,
                    alignment: 'left'
                });
                return this;
            },

            toggleProperties: function () {
                var is_visible = this.isPropertiesVisible();
                this.$('#select-searching-properties').slideToggle("fast");
                this.$('.arrow').switchClass('mdi-chevron-up', !is_visible);
                this.$('.arrow').switchClass('mdi-chevron-down', is_visible);
            },

            isPropertiesVisible: function () {
                if (this.$('#select-searching-properties').css('display') === 'none')
                    return false;
                else
                    return true;
            },

            discover: function () {
                var domain = _.escape(this.$('.search-input.simple-input-field').val());
                if (domain) {
                    if (this.isPropertiesVisible())
                        this.toggleProperties();
                    this.$('.searching-more').html("");
                    var searching_title = this.$('#searching_property_title').val(),
                        searching_sort_by = this.$('#searching_property_sort_by').val();
                    this.$('.searching-result-wrap .preloader-wrapper').show();
                    this.searchExistingGroupChats(domain);
                }
            },

            setColor: function () {
                if (this.account) {
                    var color = this.account.settings.get('color');
                    this.data.set('color', color);
                }
            },

            colorUpdated: function () {
                var color = this.data.get('color');
                this.$el.attr('data-color', color);
            },

            keyUp: function (ev) {
                if (this.$('.search-input').val() === "")
                    this.$('.btn-search').addClass('none-active');
                else
                    this.$('.btn-search').removeClass('none-active');
                if (ev.keyCode === constants.KEY_ENTER)
                    this.discover();
            },

            searchExistingGroupChats: function (domain) {
                this.account.connection.disco.items((domain), null, this.getGroupchatService.bind(this), this.onDiscoveringError.bind(this));
            },

            onDiscoveringError: function (error) {
                this.endDiscovering();
                this.$('.chats-list').html("");
                this.$('.result-string').text('No matches for "' + $(error).attr('from') + '"');
            },

            endDiscovering: function () {
                this.$('.searching-result-wrap .preloader-wrapper').hide();
            },

            getGroupchatService: function (stanza) {
                $(stanza).find('query item').each(function (idx, item) {
                    if ($(item).attr('node') === Strophe.NS.GROUP_CHAT) {
                        var jid = $(item).attr('jid');
                        this.getGroupchatFeatures(jid);
                    }
                }.bind(this));
                this.endDiscovering();
            },

            getGroupchatFeatures: function (jid) {
                var iq = $iq({type: 'get', to: jid})
                    .c('query', {xmlns: Strophe.NS.DISCO_INFO, node: Strophe.NS.GROUP_CHAT});
                this.account.sendIQ(iq, this.getServerInfo.bind(this), this.onDiscoveringError.bind(this));
            },

            getServerInfo: function (stanza) {
                $(stanza).find('query identity').each(function (idx, item) {
                    var $item = $(item);
                    if (($item.attr('category') === 'conference') && ($item.attr('type') === 'server')) {
                        var jid = $(stanza).attr('from');
                        this.getChatsFromSever(jid);
                    }
                }.bind(this));
            },

            getChatsFromSever: function (jid) {
                var iq = $iq({type: 'get', to: jid}).c('query', {xmlns: Strophe.NS.DISCO_ITEMS, node: Strophe.NS.GROUP_CHAT});
                this.account.sendIQ(iq, function (stanza) {
                    this.$('.chats-list').html("");
                    $(stanza).find('query item').each(function (idx, item) {
                        var $item = $(item),
                            name = $item.attr('name'),
                            jid = $item.attr('jid'),
                            $chat_item_html = $(templates.existing_groupchat_item({name: name, jid: jid, color: this.account.settings.get('color')})),
                            avatar = Images.getDefaultAvatar(name);
                        $chat_item_html.find('.circle-avatar').setAvatar(avatar, 32);
                        $chat_item_html.appendTo(this.$('.searching-result-wrap .chats-list'));
                    }.bind(this));
                    this.$('.result-string').text('Discovered ' + $(stanza).find('query item').length + ' group chats by ' + this.account.get('jid'));
                }.bind(this));
            },

            bindAccount: function (account) {
                this.account = account;
                this.$('.account-field .dropdown-button .account-item-wrap')
                    .replaceWith(this.renderAccountItem(account));
                this.setColor();
            },

            renderAccountItem: function (account) {
                var $item = $(templates.searching_account_item({jid: account.get('jid')}));
                return $item;
            },

            selectAccount: function (ev) {
                var $item = $(ev.target).closest('.account-item-wrap'),
                    account = xabber.accounts.get($item.data('jid'));
                this.bindAccount(account);
            },

            getChatProperties: function (ev) {
                var $target = $(ev.target).closest('.existing-chat-wrap'),
                    jid = $target.data('jid'),
                    name = $target.data('name'),
                    request_iq = $iq({type: 'get', to: jid})
                        .c('query', {xmlns: Strophe.NS.DISCO_INFO});
                this.account.sendIQ(request_iq, function (iq_response) {
                    var $iq_response = $(iq_response),
                        description = $iq_response.find('field[var="description"] value').text(),
                        anonymous = $iq_response.find('field[var="anonymous"] value').text(),
                        membership = $iq_response.find('field[var="model"] value').text(),
                        chat_properties = {jid: jid, name: name, anonymous: anonymous, description: description, membership: membership};
                    this.more_info_view = this.addChild('groupchat_properties', xabber.MoreInfoView,
                        {model: this, chat_properties: chat_properties, el: this.$('.searching-more')[0]})
                }.bind(this));
            }
        });

        xabber.MoreInfoView = xabber.BasicView.extend({
            className: 'searching-main noselect',
            template: templates.existing_groupchat_details_view,

            events: {
                "click .btn-join-chat": "joinChat"
            },

            _initialize: function (options) {
                this.account = this.model.account;
                this.chat_properties = options.chat_properties;
                this.$el.html(this.template(this.chat_properties));
            },

            render: function (options) {

            },

            joinChat: function () {
                let contact = this.account.contacts.mergeContact(this.chat_properties.jid);
                contact.set('group_chat', true);
                contact.invitation.joinGroupChat();
            }
        });

        xabber.Searching = Backbone.Model.extend({

            initialize: function (options) {
                this.account = options.account;
            },

            getSearchingFields: function () {
                let this_domain = 'xabber.com',//this.account.connection && this.account.connection.domain,
                    iq_get = $iq({from: this.account.get('jid'), type: 'get', to: 'index.' + this_domain}).c('query', {xmlns: Strophe.NS.INDEX + '#groupchat'});
                this.account.sendIQ(iq_get, this.parseSearchingFields);
            },

            parseSearchingFields: function (iq_result) {
                let $result = $(iq_result),
                    $fields = $result.find('x[xmlns = "' + Strophe.NS.XDATA + '"] field'),
                    supported_fields = [];
                $fields.each(function (idx, field) {
                    let $field = $(field);
                    if ($field.attr('type') !== 'hidden')
                        supported_fields.push({var: $field.attr('var'), label: $field.attr('label')});
                }.bind(this));
            },
        });

        xabber.LocalSearchingView = xabber.BasicView.extend({
            className: '',
            // template:,

            events: {

            },

            _initialize: function (options) {
                this.account = options.account;
            },

            render: function () {

            },

            search: function (query) {
            }
        });

        xabber.GlobalSearchingView = xabber.BasicView.extend({
            className: '',
            // template:,

            events: {

            },

            _initialize: function (options) {
                this.account = options.account;
                this.indexed_chats = [];
            },

            render: function () {

            },

            search: function (query) {
                this.indexed_chats = [];
                let iq_search = $iq({to:'index.xabber.com', type: 'set', from: this.account.get('jid')})
                    .c('query', {xmlns: Strophe.NS.INDEX + '#groupchat'})
                    .c('x', {xmlns: Strophe.NS.XDATA, type: 'form'})
                    .c('field', {var: 'FORM_TYPE', type:'hidden'})
                    .c('value').t(Strophe.NS.INDEX + '#groupchat').up().up();
                if (query.description)
                    iq_search.c('field', {var: 'description'})
                        .c('value').t(query.description).up().up();
                if (query.name)
                    iq_search.c('field', {var: 'name'})
                        .c('value').t(query.name).up().up();
                if (query.model)
                    iq_search.c('field', {var: 'model'})
                        .c('value').t(query.model).up().up();
                if (query.anywhere)
                    iq_search.c('field', {var: 'anywhere'})
                        .c('value').t(query.anywhere).up().up();
                this.account.sendIQ(iq_search, this.onSearched.bind(this));
            },

            onSearched: function (result) {
                let $result = $(result),
                    $chats = $($result.find('query item groupchat'));
                $chats.each(function (idx, chat) {
                    let $chat = $(chat),
                        chat_jid = $chat.attr('jid'),
                        attrs = {jid: chat_jid},
                        $properties = $chat.children();
                    $properties.each(function (idx, property) {
                        let $property = $(property),
                            property_name = $property[0].tagName.replace(/-/g, '_'),
                            property_value = $property.text();
                        _.extend(attrs, {[property_name]: property_value});
                    }.bind(this));
                    this.indexed_chats.push(attrs);
                }.bind(this));
            }
        });

        xabber.once("start", function () {
            this.discovering = this.wide_panel.addChild('discovering_main',
                this.DiscoveringView);
            /*this.local_searching = new xabber.LocalSearching;
            this.global_searching = new xabber.GlobalSearching;*/
        }, xabber);

        return xabber;
    };
});
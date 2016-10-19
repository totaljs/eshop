CREATE TABLE public.tbl_common
(
  id character varying(30) NOT NULL,
  body json,
  CONSTRAINT tbl_common_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

CREATE TABLE public.tbl_contactform
(
  id character varying(20) NOT NULL,
  firstname character varying(40),
  lastname character varying(40),
  email character varying(200),
  message text,
  phone character varying(20),
  language character varying(3),
  ip character varying(80),
  datecreated timestamp without time zone DEFAULT now(),
  CONSTRAINT tbl_contactform_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

CREATE TABLE public.tbl_newsletter
(
  email character varying(200) NOT NULL,
  ip character varying(80),
  language character varying(3),
  datecreated timestamp without time zone DEFAULT now(),
  CONSTRAINT tbl_newsletter_pkey PRIMARY KEY (email)
)
WITH (
  OIDS=FALSE
);

CREATE TABLE public.tbl_order
(
  id character varying(20) NOT NULL,
  iduser character varying(20),
  status character varying(100),
  language character varying(3),
  reference character varying(30),
  delivery character varying(30),
  firstname character varying(40),
  lastname character varying(40),
  email character varying(200),
  phone character varying(20),
  address character varying(1000),
  message character varying(500),
  search character varying(80),
  note character varying(500),
  ip character varying(80),
  price real DEFAULT 0,
  count smallint DEFAULT 0,
  iscompleted boolean DEFAULT false,
  ispaid boolean DEFAULT false,
  isremoved boolean DEFAULT false,
  datecompleted timestamp without time zone,
  datepaid timestamp without time zone,
  datecreated timestamp without time zone DEFAULT now(),
  dateupdated timestamp without time zone,
  adminupdated character varying(30),
  CONSTRAINT tbl_order_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

CREATE TABLE public.tbl_order_product
(
  idorder character varying(20),
  idproduct character varying(20),
  name character varying(80),
  reference character varying(20),
  pictures character varying(100),
  price real DEFAULT 0,
  count smallint DEFAULT 0
)
WITH (
  OIDS=FALSE
);

CREATE TABLE public.tbl_page
(
  id character varying(20) NOT NULL,
  parent character varying(20),
  pictures character varying(500),
  navigations character varying(1000),
  partial character varying(500),
  tags character varying(500),
  template character varying(30),
  language character varying(3),
  url character varying(200),
  icon character varying(20),
  name character varying(50),
  title character varying(100),
  search character varying(2000),
  keywords character varying(200),
  perex character varying(500),
  priority smallint DEFAULT (0)::smallint,
  body text,
  ispartial boolean DEFAULT false,
  isremoved boolean DEFAULT false,
  datecreated timestamp without time zone DEFAULT now(),
  dateupdated timestamp without time zone,
  admincreated character varying(30),
  adminupdated character varying(30),
  CONSTRAINT tbl_page_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

CREATE TABLE public.tbl_page_widget
(
  idpage character varying(20),
  idwidget character varying(20),
  settings character varying(500)
)
WITH (
  OIDS=FALSE
);

CREATE INDEX tbl_page_widget_id
  ON public.tbl_page_widget
  USING btree
  (idpage COLLATE pg_catalog."default", idwidget COLLATE pg_catalog."default");

CREATE TABLE public.tbl_post
(
  id character varying(20) NOT NULL,
  name character varying(80),
  linker character varying(80),
  category character varying(50),
  category_linker character varying(50),
  template character varying(30),
  language character varying(3),
  perex character varying(500),
  keywords character varying(200),
  tags character varying(500),
  search character varying(1000),
  pictures character varying(1000),
  body text,
  isremoved boolean DEFAULT false,
  datecreated timestamp without time zone DEFAULT now(),
  dateupdated timestamp without time zone,
  admincreated character varying(30),
  adminupdated character varying(30),
  CONSTRAINT tbl_post_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

CREATE TABLE public.tbl_product
(
  id character varying(20) NOT NULL,
  pictures character varying(500),
  reference character varying(20),
  linker character varying(300),
  linker_category character varying(300),
  linker_manufacturer character varying(50),
  category character varying(50),
  manufacturer character varying(50),
  name character varying(50),
  search character varying(80),
  price real DEFAULT 0,
  body text,
  istop boolean DEFAULT false,
  isremoved boolean DEFAULT false,
  datecreated timestamp without time zone DEFAULT now(),
  dateupdated timestamp without time zone,
  admincreated character varying(30),
  adminupdated character varying(30),
  CONSTRAINT tbl_product_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);


CREATE TABLE public.tbl_user
(
  id character varying(20) NOT NULL,
  idfacebook character varying(30),
  idgoogle character varying(30),
  idlinkedin character varying(30),
  idinstagram character varying(30),
  idyandex character varying(30),
  iddropbox character varying(30),
  idvk character varying(30),
  idyahoo character varying(30),
  idlive character varying(30),
  ip character varying(80),
  name character varying(50),
  search character varying(80),
  email character varying(200),
  password character varying(50),
  firstname character varying(50),
  lastname character varying(50),
  gender character varying(20),
  countlogin integer DEFAULT 0,
  isblocked boolean DEFAULT false,
  isremoved boolean DEFAULT false,
  datelogged timestamp without time zone,
  datecreated timestamp without time zone DEFAULT now(),
  dateupdated timestamp without time zone,
  CONSTRAINT tbl_user_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);


CREATE TABLE public.tbl_visitor
(
  id character varying(20) NOT NULL,
  day smallint DEFAULT 0,
  month smallint DEFAULT 0,
  year smallint DEFAULT 0,
  pages integer DEFAULT 0,
  hits integer DEFAULT 0,
  "unique" integer DEFAULT 0,
  uniquemonth integer DEFAULT 0,
  count integer DEFAULT 0,
  search integer DEFAULT 0,
  direct integer DEFAULT 0,
  social integer DEFAULT 0,
  unknown integer DEFAULT 0,
  advert integer DEFAULT 0,
  desktop integer DEFAULT 0,
  mobile integer DEFAULT 0,
  visitors integer DEFAULT 0,
  users integer DEFAULT 0,
  orders integer DEFAULT 0,
  contactforms integer DEFAULT 0,
  newsletter integer DEFAULT 0,
  robots integer DEFAULT 0,
  fulltext integer DEFAULT 0,
  counter integer DEFAULT 0,
  dateupdated timestamp without time zone,
  datecreated timestamp without time zone DEFAULT now(),
  CONSTRAINT tbl_visitor_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

CREATE TABLE public.tbl_widget
(
  id character varying(20) NOT NULL,
  name character varying(50),
  icon character varying(20),
  category character varying(50),
  body text,
  css text,
  istemplate boolean DEFAULT true,
  isremoved boolean DEFAULT false,
  datecreated timestamp without time zone DEFAULT now(),
  dateupdated timestamp without time zone,
  admincreated character varying(30),
  adminupdated character varying(30),
  CONSTRAINT tbl_widget_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

-- DEFAULT CONTENT
INSERT tbl_common VALUES('settings', '{"oauth2_linkedin_secret":"","oauth2_linkedin_key":"","oauth2_vk_secret":"","oauth2_vk_key":"","oauth2_dropbox_secret":"","oauth2_dropbox_key":"","oauth2_live_secret":"","oauth2_live_key":"","oauth2_yahoo_secret":"","oauth2_yahoo_key":"","oauth2_instagram_secret":"","oauth2_instagram_key":"","oauth2_google_secret":"","oauth2_google_key":"","oauth2_facebook_secret":"","oauth2_facebook_key":"","paypaldebug":false,"paypalsignature":"","paypalpassword":"","paypaluser":"","users":[],"defaultorderstatus":"Is waiting for approval.","deliverytypes":["Remax","UPS"],"navigations":["footer","searchbar"],"posts":["Blogs"],"templates":["default","example"],"url":"http://127.0.0.1:8000","emailsender":"info@totaljs.com","emailuserform":"info@totaljs.com","emailreply":"info@totaljs.com","emailorderform":"info@totaljs.com","emailcontactform":"info@totaljs.com","currency_entity":"&euro;","currency":"EUR"}');

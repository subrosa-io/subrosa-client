subrosa-client
==============

Secure, end to end encrypted messaging, voice and video chats.

discontinued
----

Unfortunately Subrosa is no longer maintained. Privacy is still inherent and critical to human communication, but there are many other projects working on the same goal. We recommend Open Whisper System's [Singal](https://whispersystems.org/) as an alternative. The source code for the client and [server](https://github.com/subrosa-io/subrosa-server) is archived on GitHub.

Thank you for all your support. I hope Subrosa was useful :)
-ixro

usage
-----

1. Clone this repository somewhere safe
2. Open src/index.html in your browser (or use a local http server)

**Optional**: To protect against any undiscovered XSS / code injection attacks, set up your http server to pass a 'Content-Security-Policy' header:

    default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://yourhostname http://yourhostname

Replace `yourhostname`.

Subrosa's server is also open source. [Run your own network](https://github.com/subrosa-io/subrosa-server).

build
-----

1. Install nodejs and npm
2. Clone subrosa-client
3. `$ npm install`
4. `$ npm run-script build` or `$ gulp build` if you have `gulp`.



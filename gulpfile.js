var gulp = require('gulp');
var del = require('del');
var jshint = require('gulp-jshint');
var jshintStylish = require('jshint-stylish');
var usemin = require('gulp-usemin');
var minifyCss = require('gulp-minify-css');
var uglify = require('gulp-uglify');
var minifyHtml = require('gulp-minify-html');
var merge = require('merge-stream');
var util = require('util');
var Stream = require('stream');

gulp.task('clean', function(cb) {
  del(['dist'], cb);
});

gulp.task('lint', function() {
  gulp.src('src/**/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter(jshintStylish))
    .pipe(jshint.reporter('fail'));
});

gulp.task('build', ['clean'], function() {
  var useminStream = gulp.src('src/index.html')
    .pipe(usemin({
      'css': ['concat', minifyCss()],
      'app-js': ['concat', uglify()],
      'vendor-js': ['concat', uglify()]
    }))
    .pipe(reseparateUseminOutput());
  
  var document = useminStream.document
    .pipe(minifyHtml());
  var assets = useminStream.assets;
  
  var static = gulp.src(['src/fonts/*', 'src/img/**/*', 'src/sound/*'], { base: 'src' });
  
  merge(document, assets, static).pipe(gulp.dest('dist'));
});

/*
 * gulp-usemin stupidly dumps its asset files into the main stream. This
 * separates index.html from the minified asset files in order to html-minify
 * index.html without trying to html-minify the asset files, which obviously
 * doesn't work.
 */

function reseparateUseminOutput() {
  var ret = new Stream.Writable({ objectMode: true });
  ret.document = new Stream.Readable({ objectMode: true });
  ret.assets = new Stream.Readable({ objectMode: true });
  util.inherits(ret, Stream.Writable);
  util.inherits(ret.document, Stream.Readable);
  util.inherits(ret.assets, Stream.Readable);
  var ready = null;
  ret._write = function(file, _, cb) {
    var dest;
    if (file === null) {
      ret.document.push(null);
      ret.assets.push(null);
      return cb();
    }
    
    if (file.path === 'index.html')
      { dest = 'document'; }
    else
      { dest = 'assets'; }
    
    if (ret[dest].push(file))
      { cb(); ready = null; }
    else
      { ready = cb; }
  };
  ret.document._read = ret.assets._read = function() {
    if (ready) {
      ready();
      ready = null;
    }
  };
  return ret;
}

var del = require('del');
var gulp = require('gulp');
var gulpFilter = require('gulp-filter');
var jshint = require('gulp-jshint');
var minifyCss = require('gulp-minify-css');
var minifyHtml = require('gulp-minify-html');
var uglify = require('gulp-uglify');
var usemin = require('gulp-usemin');
var jshintStylish = require('jshint-stylish');
var merge = require('merge-stream');

gulp.task('clean', function(cb) {
  del(['dist'], cb);
});

gulp.task('lint', function() {
  gulp.src('src/js/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter(jshintStylish))
    .pipe(jshint.reporter('fail'));
});

gulp.task('build', ['clean'], function() {
  var htmlFilter = gulpFilter('index.html');
  var app = gulp.src('src/index.html')
    .pipe(usemin({
      'css': ['concat', minifyCss()],
      'app-js': ['concat', uglify()],
      'vendor-js': ['concat', uglify()]
    }))
    .pipe(htmlFilter)
    .pipe(minifyHtml())
    .pipe(htmlFilter.restore());
  
  var static = gulp.src(['src/fonts/*', 'src/img/**/*', 'src/sound/*'], { base: 'src' });
  
  merge(app, static)
    .pipe(gulp.dest('dist'));
});

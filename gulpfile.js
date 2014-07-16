var del = require('del');
var gulp = require('gulp');
var gulpFilter = require('gulp-filter');
var jshint = require('gulp-jshint');
var minifyCss = require('gulp-minify-css');
var uglify = require('gulp-uglify');
var useref = require('gulp-useref');
var gulpif = require('gulp-if');
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
  var app = gulp.src('src/index.html')
	.pipe(useref.assets())
	.pipe(gulpif('*.js', uglify()))
	.pipe(gulpif('*.css', minifyCss()))
	.pipe(useref.restore())
	.pipe(useref())
  
  var static = gulp.src(['src/fonts/*', 'src/img/**/*', 'src/sound/*'], { base: 'src' });
  
  return merge(app, static)
    .pipe(gulp.dest('dist'));
});

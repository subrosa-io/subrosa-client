var gulp = require('gulp');
var del = require('del');
var jshint = require('gulp-jshint');
var jshintStylish = require('jshint-stylish');
var usemin = require('gulp-usemin');
var minifyCss = require('gulp-minify-css');
var uglify = require('gulp-uglify');
var merge = require('merge-stream');

gulp.task('clean', function(cb) {
  return del(['dist'], cb);
});

gulp.task('lint', function() {
  return gulp.src('src/**/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter(jshintStylish))
    .pipe(jshint.reporter('fail'));
});

gulp.task('build', ['clean'], function() {
  var app = gulp.src('src/index.html')
    .pipe(usemin({
      'css': ['concat', minifyCss()],
      'app-js': ['concat', uglify()],
      'vendor-js': ['concat']
    }))
    .pipe(gulp.dest('dist'));
  
  var static = gulp.src(['src/fonts/*', 'src/img/**/*', 'src/sound/*'], { base: 'src' })
    .pipe(gulp.dest('dist'));
  
  return merge(app, static);
});

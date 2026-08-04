<?php
// Exit if accessed directly
if ( !defined( 'ABSPATH' ) ) exit;

function bebuddy_child_theme_enqueue_styles() {
	wp_enqueue_style( 'bebuddy-child', get_stylesheet_directory_uri() . '/style.css', array( 'bebuddy' ) );
}
add_action( 'wp_enqueue_scripts', 'bebuddy_child_theme_enqueue_styles', 20 );

function bebuddy_child_theme_lang_setup() {
	$lang = get_stylesheet_directory() . '/languages';
	load_child_theme_textdomain( 'bebuddy', $lang );
}
add_action( 'after_setup_theme', 'bebuddy_child_theme_lang_setup' );

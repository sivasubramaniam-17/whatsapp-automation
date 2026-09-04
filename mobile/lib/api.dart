import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'config.dart';

// Thin API client: stores the JWT and attaches it as a Bearer token.
class Api {
  static const _tokenKey = 'wa_token';
  static String? _token;

  static Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
  }

  static bool get isLoggedIn => _token != null;

  static Future<void> setToken(String token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  static Future<void> logout() async {
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
  }

  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  static Future<dynamic> get(String path) async {
    final res = await http.get(Uri.parse('$kApiBaseUrl/api$path'), headers: _headers);
    return _handle(res);
  }

  static Future<dynamic> post(String path, [Map<String, dynamic>? body]) async {
    final res = await http.post(Uri.parse('$kApiBaseUrl/api$path'),
        headers: _headers, body: body == null ? null : jsonEncode(body));
    return _handle(res);
  }

  static Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    final res = await http.patch(Uri.parse('$kApiBaseUrl/api$path'),
        headers: _headers, body: jsonEncode(body));
    return _handle(res);
  }

  static dynamic _handle(http.Response res) {
    final data = res.body.isEmpty ? {} : jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) return data;
    final msg = (data is Map && data['error'] != null)
        ? data['error']
        : 'Request failed (${res.statusCode})';
    throw ApiException(msg.toString());
  }
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

import 'package:flutter/material.dart';
import '../api.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _register = false;
  final _company = TextEditingController();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final res = _register
          ? await Api.post('/auth/register', {
              'companyName': _company.text,
              'name': _name.text,
              'email': _email.text,
              'password': _password.text,
            })
          : await Api.post('/auth/login', {
              'email': _email.text,
              'password': _password.text,
            });
      await Api.setToken(res['token']);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 380),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('WhatsApp Automation',
                    style: TextStyle(
                        color: Color(0xFF25D366),
                        fontSize: 22,
                        fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                Text(_register ? 'Create your company' : 'Sign in',
                    style: const TextStyle(fontSize: 18)),
                const SizedBox(height: 20),
                if (_register) ...[
                  TextField(
                      controller: _company,
                      decoration: const InputDecoration(labelText: 'Company name')),
                  const SizedBox(height: 12),
                  TextField(
                      controller: _name,
                      decoration: const InputDecoration(labelText: 'Your name')),
                  const SizedBox(height: 12),
                ],
                TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Email')),
                const SizedBox(height: 12),
                TextField(
                    controller: _password,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Password')),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Color(0xFFF15C6D))),
                ],
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _busy ? null : _submit,
                  child: Text(_busy
                      ? '…'
                      : _register
                          ? 'Create account'
                          : 'Sign in'),
                ),
                TextButton(
                  onPressed: () => setState(() {
                    _register = !_register;
                    _error = null;
                  }),
                  child: Text(_register
                      ? 'Already have an account? Sign in'
                      : 'No account? Create company'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

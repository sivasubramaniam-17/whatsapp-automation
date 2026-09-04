import 'package:flutter/material.dart';
import 'api.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Api.loadToken();
  runApp(const WhatsAppAutomationApp());
}

const kGreen = Color(0xFF25D366);
const kBg = Color(0xFF0B141A);
const kPanel = Color(0xFF111B21);

class WhatsAppAutomationApp extends StatelessWidget {
  const WhatsAppAutomationApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'WhatsApp Automation',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: kBg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: kGreen,
          brightness: Brightness.dark,
        ),
        appBarTheme: const AppBarTheme(backgroundColor: kPanel),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: kGreen,
            foregroundColor: const Color(0xFF05221A),
          ),
        ),
      ),
      home: Api.isLoggedIn ? const HomeScreen() : const LoginScreen(),
    );
  }
}

import 'package:flutter/material.dart';
import '../api.dart';
import 'thread_screen.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});
  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  List<dynamic> _conversations = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final res = await Api.get('/conversations');
      setState(() {
        _conversations = res['conversations'];
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(child: Text(_error!, style: const TextStyle(color: Color(0xFFF15C6D))));
    }
    if (_conversations.isEmpty) {
      return const Center(child: Text('No conversations yet.'));
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        itemCount: _conversations.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (_, i) {
          final c = _conversations[i];
          final contact = c['contact'];
          final last = c['lastMessage'];
          final name = contact['name'] ?? contact['waPhone'];
          final preview = last == null
              ? '—'
              : (last['direction'] == 'outbound' ? 'You: ' : '') + (last['content'] ?? '');
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: const Color(0xFF25D366),
              child: Text(name[0].toUpperCase(),
                  style: const TextStyle(color: Color(0xFF05221A))),
            ),
            title: Text(name),
            subtitle: Text(preview, maxLines: 1, overflow: TextOverflow.ellipsis),
            trailing: c['status'] == 'pending'
                ? const Chip(
                    label: Text('needs human', style: TextStyle(fontSize: 11)),
                    backgroundColor: Color(0x33F1B43C),
                    visualDensity: VisualDensity.compact,
                  )
                : null,
            onTap: () async {
              await Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => ThreadScreen(conversationId: c['id']),
              ));
              _load();
            },
          );
        },
      ),
    );
  }
}

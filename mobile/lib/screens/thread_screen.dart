import 'package:flutter/material.dart';
import '../api.dart';

class ThreadScreen extends StatefulWidget {
  final String conversationId;
  const ThreadScreen({super.key, required this.conversationId});
  @override
  State<ThreadScreen> createState() => _ThreadScreenState();
}

class _ThreadScreenState extends State<ThreadScreen> {
  Map<String, dynamic>? _data;
  bool _windowOpen = false;
  final _reply = TextEditingController();
  final _scroll = ScrollController();
  String? _error;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await Api.get('/conversations/${widget.conversationId}');
    setState(() {
      _data = res['conversation'];
      _windowOpen = res['windowOpen'] ?? false;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  Future<void> _send() async {
    final text = _reply.text.trim();
    if (text.isEmpty || _data == null) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await Api.post('/whatsapp/send', {
        'to': _data!['contact']['waPhone'],
        'type': 'text',
        'text': text,
      });
      _reply.clear();
      await _load();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final contact = _data?['contact'];
    final messages = (_data?['messages'] as List?) ?? [];
    return Scaffold(
      appBar: AppBar(
        title: Text(contact == null
            ? 'Conversation'
            : (contact['name'] ?? contact['waPhone'])),
      ),
      body: _data == null
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (!_windowOpen)
                  Container(
                    width: double.infinity,
                    color: const Color(0x33F1B43C),
                    padding: const EdgeInsets.all(8),
                    child: const Text(
                      '24h window closed — only template messages can be sent',
                      style: TextStyle(fontSize: 12),
                      textAlign: TextAlign.center,
                    ),
                  ),
                Expanded(
                  child: ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.all(12),
                    itemCount: messages.length,
                    itemBuilder: (_, i) {
                      final m = messages[i];
                      final outbound = m['direction'] == 'outbound';
                      return Align(
                        alignment:
                            outbound ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 4),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                          constraints: BoxConstraints(
                              maxWidth:
                                  MediaQuery.of(context).size.width * 0.72),
                          decoration: BoxDecoration(
                            color: outbound
                                ? const Color(0xFF005C4B)
                                : const Color(0xFF182229),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(m['content'] ?? ''),
                              const SizedBox(height: 2),
                              Text(m['status'] ?? '',
                                  style: const TextStyle(
                                      fontSize: 10, color: Color(0xFF8696A0))),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Text(_error!,
                        style: const TextStyle(color: Color(0xFFF15C6D))),
                  ),
                SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _reply,
                            enabled: _windowOpen,
                            decoration: InputDecoration(
                              hintText: _windowOpen
                                  ? 'Type a reply…'
                                  : 'Window closed',
                            ),
                            onSubmitted: (_) => _send(),
                          ),
                        ),
                        const SizedBox(width: 8),
                        FilledButton(
                          onPressed: (_windowOpen && !_sending) ? _send : null,
                          child: const Icon(Icons.send, size: 18),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

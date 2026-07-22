// Ciscoラボ — Simulador do CLI Cisco IOS (client-side).
// NÃO é o IOS real: simula a sintaxe/modos e monta o running-config a partir
// do que foi digitado. Sem rede, sem roteamento real. Efêmero (reset ao recarregar).

(function () {
  const Term = window.Terminal;
  const container = document.getElementById('cl-terminal');
  const statusEl = document.getElementById('cl-status');
  const restartBtn = document.getElementById('cl-restart');
  if (!Term || !container) return;

  const term = new Term({
    cursorBlink: true,
    fontFamily: 'monospace',
    fontSize: 15,
    theme: { background: '#000000', foreground: '#d0d0d0' }
  });
  term.open(container);

  // ---------- Estado do dispositivo ----------
  let dev, mode, ctx, line, cursorHidden, history, histIdx, pending;

  function newIface(name) {
    return {
      name, ip: null, mask: null, shutdown: true, description: null,
      swMode: null, accessVlan: null, trunkEncap: null, trunkAllowed: null,
      natRole: null, encapVlan: null, aclIn: null, aclOut: null, helper: null,
      noSwitchport: false, ipDhcp: false, extra: []
    };
  }

  function freshDevice() {
    return {
      hostname: 'Router',
      enableSecret: null, enablePassword: null,
      domainName: null, servicePwEnc: false,
      users: [],                 // {name, secret, privilege}
      crypto: false, sshVersion: null,
      ifaces: {},                // name -> iface
      vlans: { 1: { name: 'default' } },
      routes: [],                // {net, mask, via}
      dhcpExcluded: [],          // {from, to}
      dhcpPools: {},             // name -> {...}
      aclNum: {},                // number -> {type, rules:[]}
      aclNamed: {},              // name -> {type, rules:[]}
      nat: { overload: null, statics: [] },
      lines: {
        'con 0': { password: null, login: null, transport: null, extra: [] },
        'vty 0 4': { password: null, login: null, transport: null, extra: [] }
      },
      routers: [],               // {kind, id, lines:[]}
      bannerMotd: null
    };
  }

  function reset() {
    dev = freshDevice();
    mode = 'user';
    ctx = {};
    line = '';
    cursorHidden = false;
    history = [];
    histIdx = 0;
    pending = null;
  }

  // ---------- Utilidades ----------
  function out(s) { term.write(String(s).replace(/\n/g, '\r\n')); }
  function m(tok, full, min) { return !!tok && full.startsWith(tok.toLowerCase()) && tok.length >= (min || 1); }
  const INVALID = '% Invalid input detected.';
  const INCOMPLETE = '% Incomplete command.';

  function ifTypeFull(prefix) {
    const p = prefix.toLowerCase();
    if (p.startsWith('gi') || p.startsWith('gig')) return 'GigabitEthernet';
    if (p.startsWith('fa') || p.startsWith('fas')) return 'FastEthernet';
    if (p.startsWith('te') || p.startsWith('ten')) return 'TenGigabitEthernet';
    if (p.startsWith('eth')) return 'Ethernet';
    if (p.startsWith('se') || p.startsWith('ser')) return 'Serial';
    if (p.startsWith('vl') || p.startsWith('vlan')) return 'Vlan';
    if (p.startsWith('lo')) return 'Loopback';
    if (p.startsWith('po') || p.startsWith('port')) return 'Port-channel';
    return null;
  }

  // "gi0/0", "g 0/0", "GigabitEthernet0/0.10", "vlan 1"
  function normalizeIf(rest) {
    let s = rest.join(' ').trim();
    const mm = s.match(/^([a-zA-Z-]+)\s*([\d/\.]+)$/);
    if (!mm) return null;
    const type = ifTypeFull(mm[1]);
    if (!type) return null;
    return type + mm[2];
  }

  function getIface(name) {
    if (!dev.ifaces[name]) dev.ifaces[name] = newIface(name);
    return dev.ifaces[name];
  }

  function promptStr() {
    const h = dev.hostname;
    switch (mode) {
      case 'user': return h + '>';
      case 'priv': return h + '#';
      case 'config': return h + '(config)#';
      case 'if': return h + '(config-if)#';
      case 'subif': return h + '(config-subif)#';
      case 'line': return h + '(config-line)#';
      case 'router': return h + '(config-router)#';
      case 'vlan': return h + '(config-vlan)#';
      case 'dhcp': return h + '(dhcp-config)#';
      case 'acl-std': return h + '(config-std-nacl)#';
      case 'acl-ext': return h + '(config-ext-nacl)#';
      default: return h + '#';
    }
  }

  // ---------- show ----------
  function maskToWild() {}

  function showRun() {
    const L = [];
    L.push('Building configuration...');
    L.push('');
    L.push('Current configuration:');
    L.push('!');
    L.push('version 15.1');
    if (dev.servicePwEnc) L.push('service password-encryption');
    L.push('!');
    L.push('hostname ' + dev.hostname);
    L.push('!');
    if (dev.enableSecret) L.push('enable secret ' + dev.enableSecret);
    else if (dev.enablePassword) L.push('enable password ' + dev.enablePassword);
    if (dev.enableSecret || dev.enablePassword) L.push('!');
    dev.users.forEach(u => {
      let s = 'username ' + u.name;
      if (u.privilege != null) s += ' privilege ' + u.privilege;
      s += (u.secretType === 'secret' ? ' secret ' : ' password ') + u.pass;
      L.push(s);
    });
    if (dev.users.length) L.push('!');
    dev.dhcpExcluded.forEach(e => L.push('ip dhcp excluded-address ' + e.from + (e.to ? ' ' + e.to : '')));
    Object.keys(dev.dhcpPools).forEach(name => {
      const p = dev.dhcpPools[name];
      L.push('ip dhcp pool ' + name);
      if (p.network) L.push(' network ' + p.network + ' ' + p.mask);
      if (p.defaultRouter) L.push(' default-router ' + p.defaultRouter);
      if (p.dns) L.push(' dns-server ' + p.dns);
      if (p.domain) L.push(' domain-name ' + p.domain);
      if (p.lease) L.push(' lease ' + p.lease);
      L.push('!');
    });
    if (dev.domainName) { L.push('ip domain-name ' + dev.domainName); L.push('!'); }

    // interfaces
    Object.keys(dev.ifaces).forEach(name => {
      const i = dev.ifaces[name];
      L.push('interface ' + name);
      if (i.description) L.push(' description ' + i.description);
      if (i.encapVlan) L.push(' encapsulation dot1Q ' + i.encapVlan);
      if (i.noSwitchport) L.push(' no switchport');
      if (i.swMode) L.push(' switchport mode ' + i.swMode);
      if (i.accessVlan) L.push(' switchport access vlan ' + i.accessVlan);
      if (i.trunkEncap) L.push(' switchport trunk encapsulation ' + i.trunkEncap);
      if (i.trunkAllowed) L.push(' switchport trunk allowed vlan ' + i.trunkAllowed);
      if (i.ipDhcp) L.push(' ip address dhcp');
      else if (i.ip) L.push(' ip address ' + i.ip + ' ' + i.mask);
      if (i.natRole) L.push(' ip nat ' + i.natRole);
      if (i.helper) L.push(' ip helper-address ' + i.helper);
      if (i.aclIn) L.push(' ip access-group ' + i.aclIn + ' in');
      if (i.aclOut) L.push(' ip access-group ' + i.aclOut + ' out');
      i.extra.forEach(x => L.push(' ' + x));
      if (!i.shutdown) L.push(' no shutdown'); else L.push(' shutdown');
      L.push('!');
    });

    // NAT
    if (dev.nat.overload) {
      L.push('ip nat inside source list ' + dev.nat.overload.list + ' interface ' + dev.nat.overload.iface + ' overload');
    }
    dev.nat.statics.forEach(s => L.push('ip nat inside source static ' + s.inside + ' ' + s.outside));

    // routing protocols
    dev.routers.forEach(r => {
      L.push('router ' + r.kind + (r.id ? ' ' + r.id : ''));
      r.lines.forEach(x => L.push(' ' + x));
      L.push('!');
    });

    // static routes
    dev.routes.forEach(r => L.push('ip route ' + r.net + ' ' + r.mask + ' ' + r.via));
    if (dev.routes.length) L.push('!');

    // ACLs
    Object.keys(dev.aclNum).forEach(n => {
      dev.aclNum[n].rules.forEach(r => L.push('access-list ' + n + ' ' + r));
    });
    Object.keys(dev.aclNamed).forEach(name => {
      const a = dev.aclNamed[name];
      L.push('ip access-list ' + a.type + ' ' + name);
      a.rules.forEach(r => L.push(' ' + r));
      L.push('!');
    });

    // crypto / ssh
    if (dev.sshVersion) L.push('ip ssh version ' + dev.sshVersion);

    // lines
    ['con 0', 'vty 0 4'].forEach(key => {
      const ln = dev.lines[key];
      if (!ln) return;
      L.push('line ' + key);
      if (ln.password) L.push(' password ' + ln.password);
      if (ln.login) L.push(' login' + (ln.login === 'local' ? ' local' : ''));
      if (ln.transport) L.push(' transport input ' + ln.transport);
      ln.extra.forEach(x => L.push(' ' + x));
    });
    L.push('!');
    L.push('end');
    return L.join('\n');
  }

  function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(1, n - s.length)); }

  function showIpIntBrief() {
    const L = ['Interface              IP-Address      OK? Method Status                Protocol'];
    Object.keys(dev.ifaces).forEach(name => {
      const i = dev.ifaces[name];
      const ip = i.ipDhcp ? 'unassigned' : (i.ip || 'unassigned');
      const status = i.shutdown ? 'administratively down' : 'up';
      const proto = i.shutdown ? 'down' : (i.ip || i.ipDhcp ? 'up' : 'down');
      L.push(pad(name, 23) + pad(ip, 16) + 'YES ' + pad(i.ip ? 'manual' : 'unset', 7) + pad(status, 22) + proto);
    });
    if (Object.keys(dev.ifaces).length === 0) L.push('(no interfaces configured)');
    return L.join('\n');
  }

  function showIpRoute() {
    const L = [];
    L.push('Codes: C - connected, S - static, L - local');
    L.push('');
    // connected from interfaces with IP
    Object.keys(dev.ifaces).forEach(name => {
      const i = dev.ifaces[name];
      if (i.ip && !i.shutdown) {
        L.push('C    ' + i.ip + ' is directly connected, ' + name);
      }
    });
    dev.routes.forEach(r => {
      L.push('S    ' + r.net + ' ' + r.mask + ' [1/0] via ' + r.via);
    });
    if (!dev.routes.length && !Object.keys(dev.ifaces).some(n => dev.ifaces[n].ip)) {
      L.push('(no routes)');
    }
    return L.join('\n');
  }

  function showVlanBrief() {
    const L = ['VLAN Name                             Status    Ports', '---- -------------------------------- --------- -------'];
    Object.keys(dev.vlans).forEach(id => {
      L.push(pad(id, 5) + pad(dev.vlans[id].name || 'VLAN' + id, 33) + 'active');
    });
    return L.join('\n');
  }

  function showAccessLists() {
    const L = [];
    Object.keys(dev.aclNum).forEach(n => {
      const a = dev.aclNum[n];
      L.push((a.type === 'standard' ? 'Standard' : 'Extended') + ' IP access list ' + n);
      a.rules.forEach(r => L.push('    ' + r));
    });
    Object.keys(dev.aclNamed).forEach(name => {
      const a = dev.aclNamed[name];
      L.push((a.type === 'standard' ? 'Standard' : 'Extended') + ' IP access list ' + name);
      a.rules.forEach(r => L.push('    ' + r));
    });
    if (!L.length) L.push('(no access lists)');
    return L.join('\n');
  }

  function showVersion() {
    return 'Cisco IOS Software, Simulator (Ciscoラボ)\n' +
           dev.hostname + ' uptime is 0 minutes\n' +
           'This is a browser-side simulator — not real IOS.';
  }

  // ---------- Execução por modo ----------
  function execUser(t, raw) {
    if (m(t[0], 'enable', 2) || t[0] === 'en') {
      if (dev.enableSecret || dev.enablePassword) {
        const expect = dev.enableSecret || dev.enablePassword;
        pending = { prompt: 'Password: ', noEcho: true, handler: (pw) => {
          if (pw === expect) { mode = 'priv'; return ''; }
          return '% Bad secrets\n';
        }};
        return '';
      }
      mode = 'priv';
      return '';
    }
    if (m(t[0], 'exit', 2) || m(t[0], 'logout', 3)) { return ''; }
    if (t[0] === '?') return 'enable    show    ping    exit';
    if (m(t[0], 'ping', 2)) return pingCmd(t);
    if (m(t[0], 'show', 2)) return execShow(t.slice(1));
    return INVALID;
  }

  function pingCmd(t) {
    const ip = t[1] || '';
    if (!ip) return INCOMPLETE;
    return 'Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ' + ip + ', timeout is 2 seconds:\n!!!!!\nSuccess rate is 100 percent (5/5)';
  }

  function execShow(t) {
    if (m(t[0], 'running-config', 3) || (m(t[0], 'run', 3))) return showRun();
    if (m(t[0], 'startup-config', 3) || m(t[0], 'start', 4)) return dev._saved ? showRun() : 'startup-config is not present';
    if (m(t[0], 'ip', 2)) {
      if (m(t[1], 'interface', 3) && m(t[2], 'brief', 2)) return showIpIntBrief();
      if (m(t[1], 'route', 3)) return showIpRoute();
      if (m(t[1], 'nat', 3)) return 'Pro Inside global   Inside local   Outside local  Outside global\n(no active translations — simulador)';
      if (m(t[1], 'protocols', 4)) return dev.routers.map(r => 'Routing Protocol is "' + r.kind + '"').join('\n') || '(no routing protocols)';
      if (m(t[1], 'ssh', 3)) return dev.sshVersion ? 'SSH Enabled - version ' + dev.sshVersion : 'SSH Disabled';
    }
    if (m(t[0], 'vlan', 3)) return showVlanBrief();
    if (m(t[0], 'access-lists', 3)) return showAccessLists();
    if (m(t[0], 'version', 3)) return showVersion();
    if (m(t[0], 'interfaces', 3)) return showIpIntBrief();
    if (m(t[0], 'users', 3)) return '   Line       User       Host(s)              Idle\n*  0 con 0                idle';
    return INVALID;
  }

  function execPriv(t, raw) {
    if (m(t[0], 'configure', 4) && (m(t[1], 'terminal', 1) || !t[1])) {
      mode = 'config'; return 'Enter configuration commands, one per line.  End with CNTL/Z.';
    }
    if (m(t[0], 'show', 2)) return execShow(t.slice(1));
    if (m(t[0], 'disable', 3)) { mode = 'user'; return ''; }
    if (m(t[0], 'exit', 2)) { mode = 'user'; return ''; }
    if (m(t[0], 'ping', 2)) return pingCmd(t);
    if ((m(t[0], 'copy', 2) && m(t[1], 'running-config', 3)) || m(t[0], 'write', 2) || (m(t[0], 'wr', 2))) {
      dev._saved = true; return 'Building configuration...\n[OK]';
    }
    if (m(t[0], 'reload', 3)) return 'Proceed with reload? [confirm]  (simulador: use リセット)';
    if (m(t[0], 'clock', 2) || m(t[0], 'debug', 3) || m(t[0], 'terminal', 4)) return '';
    if (t[0] === '?') return 'configure    show    copy    write    ping    disable    exit';
    return INVALID;
  }

  function execConfig(t, raw) {
    const c = t[0];
    // navegação
    if (m(c, 'exit', 2)) { mode = 'priv'; return ''; }
    if (m(c, 'end', 3)) { mode = 'priv'; return ''; }
    if (c === 'do') return dispatch(t.slice(1).join(' '), true);
    if (c === '?') return 'hostname  enable  username  ip  interface  vlan  router  line  access-list  crypto  banner  service  no  do  exit';

    const no = m(c, 'no', 2);
    const a = no ? t.slice(1) : t;      // args após "no"
    const k = (a[0] || '').toLowerCase();

    if (m(k, 'hostname', 4)) { dev.hostname = no ? 'Router' : (a[1] || 'Router'); return ''; }

    if (m(k, 'enable', 2)) {
      if (m(a[1], 'secret', 3)) { dev.enableSecret = no ? null : a.slice(2).join(' '); return ''; }
      if (m(a[1], 'password', 4)) { dev.enablePassword = no ? null : a.slice(2).join(' '); return ''; }
      return INVALID;
    }

    if (m(k, 'username', 4)) {
      const name = a[1];
      if (!name) return INCOMPLETE;
      if (no) { dev.users = dev.users.filter(u => u.name !== name); return ''; }
      let priv = null, idx = 2;
      if (m(a[2], 'privilege', 4)) { priv = a[3]; idx = 4; }
      const type = m(a[idx], 'secret', 3) ? 'secret' : (m(a[idx], 'password', 4) ? 'password' : null);
      if (!type) return INCOMPLETE;
      const pass = a.slice(idx + 1).join(' ');
      dev.users = dev.users.filter(u => u.name !== name);
      dev.users.push({ name, privilege: priv, secretType: type, pass });
      return '';
    }

    if (m(k, 'service', 4) && m(a[1], 'password-encryption', 4)) { dev.servicePwEnc = !no; return ''; }

    if (m(k, 'banner', 3) && m(a[1], 'motd', 3)) {
      dev.bannerMotd = a.slice(2).join(' ').replace(/^(.)(.*)\1$/, '$2'); return '';
    }

    if (m(k, 'crypto', 3)) {
      // crypto key generate rsa [modulus N]
      if (m(a[1], 'key', 3) && m(a[2], 'generate', 3) && m(a[3], 'rsa', 3)) {
        if (!dev.domainName) return '% Please define a domain-name first.';
        const modIdx = a.findIndex(x => m(x, 'modulus', 3));
        if (modIdx >= 0 && a[modIdx + 1]) { dev.crypto = true; return 'The name for the keys will be: ' + dev.hostname + '.' + dev.domainName + '\n[OK] (' + a[modIdx + 1] + ' bit keys generated)'; }
        pending = { prompt: 'How many bits in the modulus [512]: ', handler: (bits) => {
          dev.crypto = true; return '[OK] (' + (bits || '512') + ' bit keys generated)';
        }};
        return 'The name for the keys will be: ' + dev.hostname + '.' + dev.domainName;
      }
      return INVALID;
    }

    if (m(k, 'ip', 2)) return execConfigIp(a.slice(1), no);

    if (m(k, 'interface', 3)) {
      // subinterface?
      const name = normalizeIf(a.slice(1));
      if (!name) return INVALID;
      getIface(name);
      ctx.ifaces = [name];
      mode = name.includes('.') ? 'subif' : 'if';
      return '';
    }

    if (m(k, 'vlan', 3)) {
      const id = a[1];
      if (!id) return INCOMPLETE;
      if (no) { delete dev.vlans[id]; return ''; }
      if (!dev.vlans[id]) dev.vlans[id] = { name: 'VLAN' + id };
      ctx.vlan = id; mode = 'vlan'; return '';
    }

    if (m(k, 'router', 4)) {
      const kind = (a[1] || '').toLowerCase();
      if (!kind) return INCOMPLETE;
      let r = dev.routers.find(x => x.kind === kind && x.id === (a[2] || null));
      if (!r) { r = { kind, id: a[2] || null, lines: [] }; dev.routers.push(r); }
      ctx.router = r; mode = 'router'; return '';
    }

    if (m(k, 'line', 3)) {
      let key = a.slice(1).join(' ').toLowerCase();
      if (key.startsWith('con')) key = 'con 0';
      else if (key.startsWith('vty')) key = 'vty ' + (a.slice(2).join(' ') || '0 4');
      if (!dev.lines[key]) dev.lines[key] = { password: null, login: null, transport: null, extra: [] };
      ctx.line = key; mode = 'line'; return '';
    }

    if (m(k, 'access-list', 4)) {
      const num = a[1];
      if (!num) return INCOMPLETE;
      const nnum = parseInt(num);
      const type = (nnum >= 100 && nnum <= 199) || (nnum >= 2000 && nnum <= 2699) ? 'extended' : 'standard';
      if (!dev.aclNum[num]) dev.aclNum[num] = { type, rules: [] };
      if (no) { delete dev.aclNum[num]; return ''; }
      dev.aclNum[num].rules.push(a.slice(2).join(' '));
      return '';
    }

    if (m(k, 'spanning-tree', 4) || m(k, 'duplex', 3) || m(k, 'speed', 3)) return '';

    return INVALID;
  }

  function execConfigIp(a, no) {
    const k = (a[0] || '').toLowerCase();

    if ((m(k, 'domain-name', 8)) || (m(k, 'domain', 6) && m(a[1], 'name', 3))) {
      const val = m(k, 'domain-name', 8) ? a[1] : a[2];
      dev.domainName = no ? null : val; return '';
    }
    if (m(k, 'routing', 4)) { return ''; }
    if (m(k, 'ssh', 3) && m(a[1], 'version', 3)) { dev.sshVersion = no ? null : a[2]; return ''; }

    if (m(k, 'dhcp', 3)) {
      if (m(a[1], 'excluded-address', 3)) {
        if (no) return '';
        dev.dhcpExcluded.push({ from: a[2], to: a[3] || null }); return '';
      }
      if (m(a[1], 'pool', 3)) {
        const name = a[2];
        if (!name) return INCOMPLETE;
        if (!dev.dhcpPools[name]) dev.dhcpPools[name] = {};
        ctx.dhcp = name; mode = 'dhcp'; return '';
      }
      return INVALID;
    }

    if (m(k, 'route', 3)) {
      // ip route NET MASK NEXTHOP
      if (a.length < 4) return INCOMPLETE;
      if (no) { dev.routes = dev.routes.filter(r => !(r.net === a[1] && r.mask === a[2])); return ''; }
      dev.routes.push({ net: a[1], mask: a[2], via: a.slice(3).join(' ') });
      return '';
    }

    if (m(k, 'nat', 3)) {
      // ip nat inside source list N interface X overload
      if (m(a[1], 'inside', 3) && m(a[2], 'source', 3)) {
        if (m(a[3], 'list', 3)) {
          const list = a[4];
          const ifIdx = a.findIndex(x => m(x, 'interface', 3));
          const iface = ifIdx >= 0 ? normalizeIf([a[ifIdx + 1]]) || a[ifIdx + 1] : null;
          const overload = a.some(x => m(x, 'overload', 4));
          dev.nat.overload = { list, iface, overload };
          return '';
        }
        if (m(a[3], 'static', 3)) {
          dev.nat.statics.push({ inside: a[4], outside: a[5] });
          return '';
        }
      }
      return INVALID;
    }

    if (m(k, 'access-list', 4)) {
      // ip access-list standard|extended NAME
      const type = m(a[1], 'standard', 3) ? 'standard' : (m(a[1], 'extended', 3) ? 'extended' : null);
      const name = a[2];
      if (!type || !name) return INVALID;
      if (!dev.aclNamed[name]) dev.aclNamed[name] = { type, rules: [] };
      ctx.acl = name; mode = type === 'standard' ? 'acl-std' : 'acl-ext'; return '';
    }

    return INVALID;
  }

  function execIf(t) {
    const c = t[0];
    if (m(c, 'exit', 2)) { mode = 'config'; ctx.ifaces = null; return ''; }
    if (m(c, 'end', 3)) { mode = 'priv'; ctx.ifaces = null; return ''; }
    if (c === 'do') return dispatch(t.slice(1).join(' '), true);
    if (c === '?') return 'ip  no  shutdown  description  switchport  encapsulation  exit';

    const targets = (ctx.ifaces || []).map(getIface);
    const no = m(c, 'no', 2);
    const a = no ? t.slice(1) : t;
    const k = (a[0] || '').toLowerCase();

    function apply(fn) { targets.forEach(fn); return ''; }

    if (m(k, 'shutdown', 4)) return apply(i => { i.shutdown = no ? false : true; });
    if (m(k, 'description', 4)) return apply(i => { i.description = no ? null : a.slice(1).join(' '); });

    if (m(k, 'ip', 2)) {
      if (m(a[1], 'address', 3)) {
        if (no) return apply(i => { i.ip = null; i.mask = null; i.ipDhcp = false; });
        if (m(a[2], 'dhcp', 3)) return apply(i => { i.ipDhcp = true; i.ip = null; });
        if (!a[2] || !a[3]) return INCOMPLETE;
        return apply(i => { i.ip = a[2]; i.mask = a[3]; i.ipDhcp = false; });
      }
      if (m(a[1], 'nat', 3)) {
        const role = m(a[2], 'inside', 3) ? 'inside' : (m(a[2], 'outside', 3) ? 'outside' : null);
        if (!role) return INVALID;
        return apply(i => { i.natRole = no ? null : role; });
      }
      if (m(a[1], 'access-group', 3)) {
        const which = a[3];
        if (which === 'in') return apply(i => { i.aclIn = no ? null : a[2]; });
        if (which === 'out') return apply(i => { i.aclOut = no ? null : a[2]; });
        return INVALID;
      }
      if (m(a[1], 'helper-address', 3)) return apply(i => { i.helper = no ? null : a[2]; });
      return INVALID;
    }

    if (m(k, 'switchport', 4)) {
      if (m(a[1], 'mode', 3)) return apply(i => { i.swMode = a[2]; });
      if (m(a[1], 'access', 3) && m(a[2], 'vlan', 3)) return apply(i => { i.accessVlan = a[3]; });
      if (m(a[1], 'trunk', 3) && m(a[2], 'encapsulation', 3)) return apply(i => { i.trunkEncap = a[3]; });
      if (m(a[1], 'trunk', 3) && m(a[2], 'allowed', 3) && m(a[3], 'vlan', 3)) return apply(i => { i.trunkAllowed = a.slice(4).join(' '); });
      if (no) return apply(i => { i.noSwitchport = true; });
      return INVALID;
    }
    if (no && m(k, 'switchport', 4)) return apply(i => { i.noSwitchport = true; });

    if (m(k, 'encapsulation', 4)) {
      // subinterface: encapsulation dot1Q VLAN
      const vlan = a[2];
      return apply(i => { i.encapVlan = vlan; });
    }

    if (m(k, 'duplex', 3) || m(k, 'speed', 3) || m(k, 'channel-group', 4) || m(k, 'mtu', 3)) {
      return apply(i => { if (!no) i.extra.push(a.join(' ')); });
    }

    return INVALID;
  }

  function execLine(t) {
    const c = t[0];
    if (m(c, 'exit', 2)) { mode = 'config'; ctx.line = null; return ''; }
    if (m(c, 'end', 3)) { mode = 'priv'; ctx.line = null; return ''; }
    if (c === 'do') return dispatch(t.slice(1).join(' '), true);
    if (c === '?') return 'password  login  transport  exec-timeout  logging  exit';
    const ln = dev.lines[ctx.line];
    const no = m(c, 'no', 2);
    const a = no ? t.slice(1) : t;
    const k = (a[0] || '').toLowerCase();

    if (m(k, 'password', 4)) { ln.password = no ? null : a.slice(1).join(' '); return ''; }
    if (m(k, 'login', 3)) { ln.login = no ? null : (m(a[1], 'local', 3) ? 'local' : 'yes'); return ''; }
    if (m(k, 'transport', 4) && m(a[1], 'input', 3)) { ln.transport = no ? null : a.slice(2).join(' '); return ''; }
    if (m(k, 'exec-timeout', 4) || m(k, 'logging', 4)) { if (!no) ln.extra.push(a.join(' ')); return ''; }
    return INVALID;
  }

  function execRouter(t) {
    const c = t[0];
    if (m(c, 'exit', 2)) { mode = 'config'; ctx.router = null; return ''; }
    if (m(c, 'end', 3)) { mode = 'priv'; ctx.router = null; return ''; }
    if (c === 'do') return dispatch(t.slice(1).join(' '), true);
    if (c === '?') return 'network  version  no  passive-interface  exit';
    const r = ctx.router;
    const no = m(c, 'no', 2);
    const a = no ? t.slice(1) : t;
    if (no) { r.lines = r.lines.filter(x => x !== a.join(' ')); return ''; }
    r.lines.push(a.join(' '));
    return '';
  }

  function execVlan(t) {
    const c = t[0];
    if (m(c, 'exit', 2)) { mode = 'config'; ctx.vlan = null; return ''; }
    if (m(c, 'end', 3)) { mode = 'priv'; ctx.vlan = null; return ''; }
    if (c === '?') return 'name  exit';
    if (m(c, 'name', 3)) { dev.vlans[ctx.vlan].name = t.slice(1).join(' '); return ''; }
    return INVALID;
  }

  function execDhcp(t) {
    const c = t[0];
    if (m(c, 'exit', 2)) { mode = 'config'; ctx.dhcp = null; return ''; }
    if (m(c, 'end', 3)) { mode = 'priv'; ctx.dhcp = null; return ''; }
    if (c === '?') return 'network  default-router  dns-server  domain-name  lease  exit';
    const p = dev.dhcpPools[ctx.dhcp];
    if (m(c, 'network', 3)) { p.network = t[1]; p.mask = t[2]; return ''; }
    if (m(c, 'default-router', 3)) { p.defaultRouter = t.slice(1).join(' '); return ''; }
    if (m(c, 'dns-server', 3)) { p.dns = t.slice(1).join(' '); return ''; }
    if (m(c, 'domain-name', 3)) { p.domain = t[1]; return ''; }
    if (m(c, 'lease', 3)) { p.lease = t.slice(1).join(' '); return ''; }
    return INVALID;
  }

  function execAcl(t) {
    const c = t[0];
    if (m(c, 'exit', 2)) { mode = 'config'; ctx.acl = null; return ''; }
    if (m(c, 'end', 3)) { mode = 'priv'; ctx.acl = null; return ''; }
    if (c === '?') return 'permit  deny  remark  exit';
    if (m(c, 'permit', 3) || m(c, 'deny', 3) || m(c, 'remark', 3)) {
      dev.aclNamed[ctx.acl].rules.push(t.join(' ')); return '';
    }
    return INVALID;
  }

  // dispatcher central
  function dispatch(raw, fromDo) {
    const cmd = raw.trim();
    if (!cmd) return '';
    const t = cmd.split(/\s+/);
    if (fromDo) return execShowOrExec(t);
    switch (mode) {
      case 'user': return execUser(t, cmd);
      case 'priv': return execPriv(t, cmd);
      case 'config': return execConfig(t, cmd);
      case 'if': case 'subif': return execIf(t);
      case 'line': return execLine(t);
      case 'router': return execRouter(t);
      case 'vlan': return execVlan(t);
      case 'dhcp': return execDhcp(t);
      case 'acl-std': case 'acl-ext': return execAcl(t);
      default: return INVALID;
    }
  }

  // "do <cmd>" roda comandos EXEC a partir do config
  function execShowOrExec(t) {
    if (m(t[0], 'show', 2)) return execShow(t.slice(1));
    if (m(t[0], 'ping', 2)) return pingCmd(t);
    if (m(t[0], 'write', 2) || m(t[0], 'wr', 2)) { dev._saved = true; return 'Building configuration...\n[OK]'; }
    return INVALID;
  }

  // ---------- Terminal I/O ----------
  function writePrompt() { term.write(promptStr()); }

  function commit() {
    term.write('\r\n');
    const text = line;
    line = '';
    if (pending) {
      const pi = pending; pending = null;
      const o = pi.handler(text.trim());
      if (o) out(o + '\n');
    } else {
      if (text.trim()) { history.push(text); histIdx = history.length; }
      const o = dispatch(text);
      if (o) out(o + '\n');
    }
    if (pending) term.write(pending.prompt);
    else writePrompt();
  }

  function backspace() {
    if (line.length > 0) {
      line = line.slice(0, -1);
      if (!(pending && pending.noEcho)) term.write('\b \b');
    }
  }

  function replaceLine(newLine) {
    // apaga a linha atual e escreve a nova (pra histórico)
    term.write('\r' + ' '.repeat(promptStr().length + line.length) + '\r');
    writePrompt();
    line = newLine;
    term.write(newLine);
  }

  term.onData((data) => {
    if (data === '\r' || data === '\n') { commit(); return; }
    if (data === '\x7f' || data === '\b') { backspace(); return; }
    if (data === '\x03') { // Ctrl+C
      term.write('^C\r\n'); line = ''; pending = null; writePrompt(); return;
    }
    if (data === '\x1b[A') { // seta pra cima (histórico)
      if (!pending && history.length && histIdx > 0) { histIdx--; replaceLine(history[histIdx]); }
      return;
    }
    if (data === '\x1b[B') { // seta pra baixo
      if (!pending && history.length) {
        if (histIdx < history.length - 1) { histIdx++; replaceLine(history[histIdx]); }
        else { histIdx = history.length; replaceLine(''); }
      }
      return;
    }
    if (data.charCodeAt(0) === 0x1b) return; // outras sequências de escape: ignora
    // caracteres imprimíveis
    for (const ch of data) {
      if (ch >= ' ' && ch.charCodeAt(0) !== 0x7f) {
        line += ch;
        if (!(pending && pending.noEcho)) term.write(ch);
      }
    }
  });

  function boot() {
    reset();
    term.reset();
    out('Ciscoラボ — Cisco IOS シミュレーター (本物の IOS ではありません)\n');
    out('「enable」で特権モード、「configure terminal」で設定モード。「?」でヘルプ。\n\n');
    writePrompt();
    term.focus();
  }

  restartBtn.addEventListener('click', boot);
  boot();
})();

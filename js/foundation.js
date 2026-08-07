(function (root) {
  'use strict';

  function safeJsonParse(value, fallback) {
    try { return JSON.parse(value); } catch (err) { return fallback; }
  }

  function createStorage(namespace) {
    namespace = namespace || 'nook_epos';
    function key(name) { return namespace + ':' + name; }
    return Object.freeze({
      get: function (name, fallback) {
        var parsed = safeJsonParse(localStorage.getItem(key(name)), null);
        return parsed == null ? fallback : parsed;
      },
      set: function (name, value) { localStorage.setItem(key(name), JSON.stringify(value)); },
      remove: function (name) { localStorage.removeItem(key(name)); }
    });
  }

  function createApiClient(options) {
    options = options || {};
    return Object.freeze({
      request: async function (action, payload, requestOptions) {
        requestOptions = requestOptions || {};
        var url = String(options.getUrl() || '').trim();
        if (!url || /PASTE_YOUR_DEPLOYED/i.test(url)) throw new Error('Google Script URL is not configured.');
        var request = Object.assign({}, payload || {}, {
          action: action,
          client: 'browser',
          frontendVersion: options.frontendVersion || 'unknown'
        });
        var criticalWriteActions = ['commitTicket','holdOrder','deleteHeldOrder','kitchenUpdate','refundTicket','saveCategory','saveItem','saveItemConfiguration','saveItemConfigurationPatch','savePrompt','savePromptOption','savePromptOptionsBatch','copyItemPrompts','archiveDeleteEntity','saveSetting','saveConfirmedUrl','clearReports'];
        var longReadActions = options.longReadActions || ['bootstrap','serverInfo','connectionCheck','previewDatabaseRepair','diagnosticsRun'];
        var isCriticalWrite = criticalWriteActions.indexOf(action) >= 0;
        var isLongRead = longReadActions.indexOf(action) >= 0;
        var timeoutMs = isCriticalWrite
          ? (Number(options.writeTimeoutMs) || 30000)
          : isLongRead
            ? (Number(options.longReadTimeoutMs) || 45000)
            : (Number(options.readTimeoutMs) || 10000);
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var externalSignal = requestOptions.signal || null;
        var externallyAborted = !!(externalSignal && externalSignal.aborted);
        var externalAbortHandler = null;
        if (externallyAborted) {
          var alreadyCancelled = new Error('Server read was cancelled because browser state changed.');
          alreadyCancelled.code = 'REQUEST_ABORTED';
          alreadyCancelled.action = action;
          throw alreadyCancelled;
        }
        if (controller && externalSignal && typeof externalSignal.addEventListener === 'function') {
          externalAbortHandler = function () { externallyAborted = true; controller.abort(); };
          externalSignal.addEventListener('abort', externalAbortHandler, { once: true });
        }
        var timeout = controller ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;
        var response;
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(request),
            signal: controller ? controller.signal : (externalSignal || undefined)
          });
        } catch (err) {
          if (err && err.name === 'AbortError') {
            if (externallyAborted || (externalSignal && externalSignal.aborted)) {
              var cancelledError = new Error('Server read was cancelled because browser state changed.');
              cancelledError.code = 'REQUEST_ABORTED';
              cancelledError.action = action;
              throw cancelledError;
            }
            var timeoutError = new Error('Server request timed out after ' + Math.round(timeoutMs / 1000) + ' seconds.');
            timeoutError.code = 'REQUEST_TIMEOUT';
            timeoutError.action = action;
            throw timeoutError;
          }
          throw err;
        } finally {
          if (timeout) clearTimeout(timeout);
          if (externalAbortHandler && externalSignal && typeof externalSignal.removeEventListener === 'function') externalSignal.removeEventListener('abort', externalAbortHandler);
        }
        if (!response.ok) {
          var httpError = new Error('Server returned HTTP ' + response.status);
          httpError.status = response.status;
          httpError.code = 'HTTP_' + response.status;
          httpError.action = action;
          throw httpError;
        }
        var json = await response.json();
        if (!json.ok) throw new Error(json.error || 'Server returned an error.');
        return json;
      }
    });
  }

  function createUi(options) {
    options = options || {};
    function rootElement() { return document.getElementById(options.modalRootId || 'modalRoot'); }
    function toastRoot() { return document.getElementById(options.toastRootId || 'toastRoot'); }
    function escape(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, function (s) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s];
      });
    }
    function icon(type) {
      return type === 'success' ? '✓' : type === 'error' ? '!' : type === 'warning' ? '!' : 'i';
    }
    return Object.freeze({
      closeModal: function () { var el = rootElement(); if (el) el.innerHTML = ''; },
      showBusy: function (title, message) {
        var el = rootElement();
        if (!el) return;
        el.innerHTML = '<div class="modal-backdrop busy-backdrop" data-busy-overlay="1"><div class="modal busy-modal" role="status" aria-live="assertive" aria-busy="true"><div class="busy-spinner" aria-hidden="true"></div><h2>' + escape(title) + '</h2><p>' + escape(message || 'Please wait') + '</p></div></div>';
      },
      hideBusy: function () {
        if (document.querySelector('[data-busy-overlay="1"]')) this.closeModal();
      },
      toast: function (message, type) {
        var el = toastRoot();
        if (!el) return;
        type = type || 'info';
        var div = document.createElement('div');
        div.className = 'toast toast-' + type;
        div.setAttribute('role', type === 'error' ? 'alert' : 'status');
        div.innerHTML = '<span class="toast-icon" aria-hidden="true">' + icon(type) + '</span><span>' + escape(message) + '</span>';
        el.appendChild(div);
        requestAnimationFrame(function () { div.classList.add('toast-visible'); });
        setTimeout(function () {
          div.classList.remove('toast-visible');
          setTimeout(function () { div.remove(); }, 180);
        }, type === 'error' ? 5200 : 3400);
      },
      confirm: function (config) {
        config = config || {};
        var el = rootElement();
        if (!el) return Promise.resolve(false);
        return new Promise(function (resolve) {
          var settled = false;
          function finish(value) {
            if (settled) return;
            settled = true;
            el.removeEventListener('click', click);
            el.innerHTML = '';
            resolve(value);
          }
          function click(event) {
            var button = event.target.closest('[data-ui-confirm]');
            if (!button) return;
            finish(button.getAttribute('data-ui-confirm') === 'yes');
          }
          el.addEventListener('click', click);
          var tone = config.tone === 'danger' ? 'danger' : 'primary';
          el.innerHTML = '<div class="modal-backdrop themed-dialog-backdrop"><div class="modal themed-dialog" role="dialog" aria-modal="true" aria-labelledby="themedDialogTitle"><div class="themed-dialog-icon themed-dialog-icon-' + escape(config.tone || 'info') + '">' + icon(config.tone || 'info') + '</div><h2 id="themedDialogTitle">' + escape(config.title || 'Please confirm') + '</h2><p>' + escape(config.message || '') + '</p><div class="row themed-dialog-actions"><button class="secondary" data-ui-confirm="no">' + escape(config.cancelLabel || 'Cancel') + '</button><button class="' + tone + '" data-ui-confirm="yes">' + escape(config.confirmLabel || 'Confirm') + '</button></div></div></div>';
          var cancel = el.querySelector('[data-ui-confirm="no"]');
          if (cancel) cancel.focus();
        });
      }
    });
  }

  function assertReleaseCompatibility(release, backendVersions) {
    release = release || {};
    backendVersions = backendVersions || {};
    var acceptedBackends = (release.acceptedBackendVersions || [release.backendVersion || release.frontendVersion || '']).map(String);
    var acceptedDatabases = (release.acceptedDatabaseVersions || [release.databaseVersion || '']).map(String);
    var actualBackend = String(backendVersions.BackendVersion || '');
    var actualDatabase = String(backendVersions.DatabaseVersion || '');
    return {
      ok: acceptedBackends.indexOf(actualBackend) >= 0 && acceptedDatabases.indexOf(actualDatabase) >= 0,
      expectedBackend: acceptedBackends.join(', '),
      acceptedBackends: acceptedBackends,
      actualBackend: actualBackend,
      expectedDatabase: acceptedDatabases.join(', '),
      acceptedDatabases: acceptedDatabases,
      actualDatabase: actualDatabase
    };
  }

  root.NookFoundation = Object.freeze({
    createStorage: createStorage,
    createApiClient: createApiClient,
    createUi: createUi,
    assertReleaseCompatibility: assertReleaseCompatibility
  });
})(typeof window !== 'undefined' ? window : globalThis);

(function (root) {
  'use strict';

  function createAdminSaveService(options) {
    options = options || {};
    var active = Object.create(null);

    async function save(config) {
      config = config || {};
      var key = String(config.key || config.action || 'admin-save');
      if (active[key]) return active[key];

      var task = (async function () {
        if (typeof options.showBusy === 'function') options.showBusy('Saving — Please wait', config.busyMessage || 'Saving changes to Google Sheets.');
        try {
          var response = await options.request(config.action, config.payload || {});
          if (typeof config.reload === 'function') await config.reload(response);
          if (typeof config.afterReload === 'function') await config.afterReload(response);
          if (typeof options.hideBusy === 'function') options.hideBusy();
          if (typeof options.notify === 'function') options.notify(config.successMessage || 'Changes saved and reloaded from Google Sheets.', 'success');
          return response;
        } catch (error) {
          if (typeof options.hideBusy === 'function') options.hideBusy();
          if (typeof config.onError === 'function') config.onError(error);
          else if (typeof options.onError === 'function') options.onError(config.errorPrefix || 'Changes were not saved', error);
          throw error;
        } finally {
          delete active[key];
        }
      })();

      active[key] = task;
      return task;
    }

    return Object.freeze({
      save: save,
      isSaving: function (key) { return !!active[String(key || '')]; }
    });
  }

  root.NookAdminSave = Object.freeze({ create: createAdminSaveService });
})(typeof window !== 'undefined' ? window : globalThis);

const { withPodfile } = require('expo/config-plugins');

module.exports = (config) => withPodfile(config, (config) => {
  const marker = '    # Disable fmt 11 consteval checks incompatible with Xcode 27.\n';
  const block = `${marker}    fmt_header = File.join(installer.sandbox.root, 'fmt/include/fmt/base.h')
    if File.exist?(fmt_header)
      contents = File.read(fmt_header)
      patched = contents.sub('#if !defined(__cpp_lib_is_constant_evaluated)', "#if defined(__apple_build_version__) && __apple_build_version__ >= 21000000L\\n#  define FMT_USE_CONSTEVAL 0\\n#elif !defined(__cpp_lib_is_constant_evaluated)")
      if patched != contents
        File.chmod(0644, fmt_header)
        File.write(fmt_header, patched)
      end
    end
    # glog includes log_severity inside a C++ namespace; it cannot be a submodule.
    glog_modulemap = File.join(installer.sandbox.root, 'Target Support Files/glog/glog.modulemap')
    if File.exist?(glog_modulemap)
      contents = File.read(glog_modulemap)
      File.write(glog_modulemap, \"module glog {\\n  header \\\"glog/logging.h\\\"\\n  textual header \\\"glog/log_severity.h\\\"\\n  textual header \\\"glog/vlog_is_on.h\\\"\\n  textual header \\\"glog/raw_logging.h\\\"\\n  textual header \\\"glog/stl_logging.h\\\"\\n  export *\\n}\\n\")
    end
`;
  if (!config.modResults.contents.includes(marker)) {
    config.modResults.contents = config.modResults.contents.replace('  post_install do |installer|\n', `  post_install do |installer|\n${block}`);
  }
  return config;
});

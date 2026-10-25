# Add a disposable UI test target to the generated, gitignored Xcode project.
# Run after `expo prebuild`, then xcodebuild test -scheme CaloriesAILocal -configuration Release.
require 'xcodeproj'
require 'fileutils'
root = File.expand_path('..', __dir__)
project_path = File.join(root, 'ios/CaloriesAILocal.xcodeproj')
project = Xcodeproj::Project.open(project_path)
name = 'NavigationSmokeTests'
abort 'UI test target already exists' if project.targets.any? { |target| target.name == name }
app = project.targets.find { |target| target.name == 'CaloriesAILocal' }
target = project.new_target(:ui_test_bundle, name, :ios, '16.4')
target.add_dependency(app)
source = project.main_group.new_file('../tests/ios-ui/NavigationSmokeTests.swift')
target.add_file_references([source])
target.build_configurations.each do |configuration|
  configuration.build_settings.merge!({
    'PRODUCT_BUNDLE_IDENTIFIER' => 'com.rados.caloriesai.NavigationSmokeTests',
    'SWIFT_VERSION' => '5.0',
    'PRODUCT_NAME' => '$(TARGET_NAME)',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'TEST_TARGET_NAME' => 'CaloriesAILocal',
    'CODE_SIGNING_ALLOWED' => 'NO',
  })
end
project.save
scheme_path = File.join(project_path, 'xcshareddata/xcschemes/CaloriesAILocal.xcscheme')
scheme = Xcodeproj::XCScheme.new(scheme_path)
scheme.add_test_target(target)
scheme.save_as(project_path, 'CaloriesAILocal', true)
puts 'NavigationSmokeTests target ready'

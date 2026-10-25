Pod::Spec.new do |s|
  s.name           = 'CaloriesPlatform'
  s.version        = '1.0.0'
  s.summary        = 'Calories AI runtime platform detection'
  s.description    = 'Distinguishes iOS apps running on a Mac from iPhone and iPad.'
  s.author         = 'Radoslav Otipka'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: 'https://github.com/radorado8/key-local-android-food-calorie-estimator.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

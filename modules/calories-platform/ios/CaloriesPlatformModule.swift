import ExpoModulesCore
import Foundation

public class CaloriesPlatformModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CaloriesPlatform")
    Constant("isIOSAppOnMac") {
      #if targetEnvironment(macCatalyst)
      return true
      #else
      return ProcessInfo.processInfo.isiOSAppOnMac
      #endif
    }
  }
}

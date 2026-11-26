import { Permissions, webMethod } from "wix-web-module";
 import { Country, State, City } from "country-state-city";

 export const getCountries = webMethod(
    Permissions.Anyone,
    async () => {
        const allowedCountryCodes = ['GR', 'IL', 'CY']; // Greece, Israel, Cyprus
        const allCountries = Country.getAllCountries();
        return allCountries.filter(country => allowedCountryCodes.includes(country.isoCode));
    }
);
 export const getstatesByCountryCode = webMethod(
     Permissions.Anyone,
     async (countryCode) => {
         return State.getStatesOfCountry(countryCode)
     }
 );

 export const getCitiesOfCountry = webMethod(
     Permissions.Anyone,
     async (countryCode) => {
         return City.getCitiesOfCountry(countryCode)
     }
 );

  export const getCitiesOfState = webMethod(
     Permissions.Anyone,
     async (countryCode, stateCode) => {
         const cities = City.getCitiesOfState(countryCode, stateCode);
         if (!cities || cities.length === 0) {
             return [{ name: 'Other', isoCode: 'OTHER' }];
         }
         return cities;
     }
 );